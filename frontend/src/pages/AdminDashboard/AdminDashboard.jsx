import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import adminService from "../../api/adminService";
import organizationService from "../../api/organizationService";
import charityService from "../../api/charityService";
import { useAuth } from "../../contexts/AuthContext";
import { SEPOLIA_ETHERSCAN_BASE } from "../../constants";
import "./AdminDashboard.css";

/* global BigInt */
const formatDateTime = (d) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleString();
  } catch {
    return "—";
  }
};

// Detect Cloudinary/standard URLs theo extension. Cloudinary có thể append
// query string transformations → tách `?` và `#` trước khi match.
const isImageUrl = (url) =>
  /\.(jpe?g|png|gif|webp|bmp|svg)(\?|#|$)/i.test(url || "");
const isPdfUrl = (url) => /\.pdf(\?|#|$)/i.test(url || "");

// % milestone trên goal — BigInt math để khỏi mất precision khi goal lớn.
// Trả Number 2 chữ số thập phân, vd 33.33.
const milestonePercent = (amountWei, goalWei) => {
  try {
    const a = BigInt(amountWei || "0");
    const g = BigInt(goalWei || "0");
    if (g === 0n) return 0;
    return Number((a * 10000n) / g) / 100;
  } catch {
    return 0;
  }
};

// MAX % per milestone — mirror với backend constants. Tránh import BE constant
// trực tiếp; nếu rule đổi thì sửa ở cả 2 nơi (CLAUDE.md đã ghi).
const MAX_MILESTONE_PERCENT = 50;

function StatCard({ title, value, hint }) {
  return (
    <div className="admin-card">
      <div className="admin-card-title">{title}</div>
      <div className="admin-card-value">{value}</div>
      {hint ? <div className="admin-card-hint">{hint}</div> : null}
    </div>
  );
}

function MiniBarChart({ series, valueKey, title }) {
  const values = (series || []).map((x) => Number(x?.[valueKey] || 0));
  const max = Math.max(1, ...values);

  return (
    <div className="admin-chart">
      <div className="admin-chart-title">{title}</div>
      <div className="admin-bars" aria-label={title}>
        {(series || []).map((x) => {
          const v = Number(x?.[valueKey] || 0);
          const h = Math.round((v / max) * 100);
          return (
            <div
              key={x.date}
              className="admin-bar-wrap"
              title={`${x.date}: ${v}`}
            >
              <div className="admin-bar" style={{ height: `${h}%` }} />
            </div>
          );
        })}
      </div>
      <div className="admin-chart-axis">
        <span>{series?.[0]?.date}</span>
        <span>{series?.[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function Tabs({ tab, setTab }) {
  const items = [
    { key: "overview", label: "Overview" },
    { key: "users", label: "Users" },
    { key: "moderation", label: "Moderation" },
    { key: "organizations", label: "Organizations" },
    { key: "charity", label: "Charity" },
    { key: "audit", label: "Audit" },
  ];
  return (
    <div className="admin-tabs">
      {items.map((it) => (
        <button
          key={it.key}
          className={`admin-tab ${tab === it.key ? "active" : ""}`}
          onClick={() => setTab(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Pagination({ page, totalPages, onPage }) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="admin-pagination">
      <button
        className="admin-btn"
        disabled={!canPrev}
        onClick={() => onPage(page - 1)}
      >
        Prev
      </button>
      <div className="admin-pagination-text">
        Page <b>{page}</b> / {totalPages || 1}
      </div>
      <button
        className="admin-btn"
        disabled={!canNext}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const role = String(user?.role || "user").toLowerCase();
  const isAdmin = role === "admin";

  const [tab, setTab] = useState("overview");
  const [days, setDays] = useState(7);

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  // Users state
  const [usersState, setUsersState] = useState({
    page: 1,
    limit: 20,
    status: "all",
    role: "all",
    verified: "all",
    q: "",
    totalPages: 1,
    users: [],
    total: 0,
  });

  // Moderation state
  const [modState, setModState] = useState({
    posts: {
      page: 1,
      limit: 20,
      status: "active",
      q: "",
      totalPages: 1,
      items: [],
    },
    comments: {
      page: 1,
      limit: 20,
      status: "active",
      q: "",
      totalPages: 1,
      items: [],
    },
  });

  // Organizations
  const [orgsState, setOrgsState] = useState({
    page: 1,
    limit: 20,
    status: "pending",
    totalPages: 1,
    items: [],
    total: 0,
  });

  // Inline expand panel: 1 org đang mở giấy tờ, 1 campaign đang xem milestone
  // plan. Cùng dùng pattern Set/state để mở nhiều cái 1 lúc nếu cần debug.
  const [expandedOrgId, setExpandedOrgId] = useState(null);
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);

  // Audit
  const [audit, setAudit] = useState([]);

  // Charity admin — 2 danh sách: FUNDED (chờ execute) + EXECUTING (chờ unlock milestone)
  // processingKey: id duy nhất của action đang chạy on-chain (để disable button + show
  // spinner). Key dạng `execute:<campaignId>` / `forceFail:<campaignId>` /
  // `unlock:<campaignId>:<idx>`. Chỉ 1 action tại 1 thời điểm — tránh confusion khi
  // user click nhiều button (mỗi action mất ~15s wait Sepolia).
  const [charityState, setCharityState] = useState({
    funded: [],
    executing: [],
    loadingFunded: false,
    loadingExecuting: false,
    processingKey: null,
    fundedFilter: "FUNDED", // status filter cho panel 1 — debug khi sync chưa kịp
    // unlock modal state
    unlockModal: null, // { campaignId, milestoneIdx, reportPostId }
  });

  const canSeeAudit = isAdmin;

  const loadStats = async (d = days) => {
    setLoading(true);
    try {
      const data = await adminService.getStats(d);
      if (!data?.success) throw new Error(data?.message || "Failed");
      setStats(data);
    } catch (e) {
      toast.error(e?.message || "Failed to load admin stats");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (overrides = {}) => {
    setLoading(true);
    try {
      const next = { ...usersState, ...overrides };
      const data = await adminService.listUsers(next);
      if (!data?.success) throw new Error(data?.message || "Failed");
      setUsersState((s) => ({
        ...s,
        ...next,
        users: data.users || [],
        total: data.total || 0,
        totalPages: data.totalPages || 1,
      }));
    } catch (e) {
      toast.error(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const loadModerationPosts = async (overrides = {}) => {
    setLoading(true);
    try {
      const next = { ...modState.posts, ...overrides };
      const data = await adminService.listModerationPosts(next);
      if (!data?.success) throw new Error(data?.message || "Failed");
      setModState((s) => ({
        ...s,
        posts: {
          ...next,
          items: data.posts || [],
          totalPages: data.totalPages || 1,
        },
      }));
    } catch (e) {
      toast.error(e?.message || "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  const loadModerationComments = async (overrides = {}) => {
    setLoading(true);
    try {
      const next = { ...modState.comments, ...overrides };
      const data = await adminService.listModerationComments(next);
      if (!data?.success) throw new Error(data?.message || "Failed");
      setModState((s) => ({
        ...s,
        comments: {
          ...next,
          items: data.comments || [],
          totalPages: data.totalPages || 1,
        },
      }));
    } catch (e) {
      toast.error(e?.message || "Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async () => {
    if (!canSeeAudit) return;
    setLoading(true);
    try {
      const data = await adminService.listAudit(80);
      if (!data?.success) throw new Error(data?.message || "Failed");
      setAudit(data.logs || []);
    } catch (e) {
      toast.error(e?.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const loadCharityFunded = async (statusOverride) => {
    setCharityState((s) => ({ ...s, loadingFunded: true }));
    try {
      const status = statusOverride ?? charityState.fundedFilter;
      const params = { limit: 50 };
      // "ALL" = không filter status → debug khi cache chưa kịp sync
      if (status && status !== "ALL") params.status = status;
      const res = await charityService.listCampaigns(params);
      setCharityState((s) => ({ ...s, funded: res.campaigns || [] }));
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load campaigns");
    } finally {
      setCharityState((s) => ({ ...s, loadingFunded: false }));
    }
  };

  const loadCharityExecuting = async () => {
    setCharityState((s) => ({ ...s, loadingExecuting: true }));
    try {
      const res = await charityService.listCampaigns({ status: "EXECUTING", limit: 50 });
      setCharityState((s) => ({ ...s, executing: res.campaigns || [] }));
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load EXECUTING campaigns");
    } finally {
      setCharityState((s) => ({ ...s, loadingExecuting: false }));
    }
  };

  // Refresh cả 2 panel sau action — campaign có thể chuyển panel (FUNDED → EXECUTING)
  const refreshCharityLists = () =>
    Promise.all([loadCharityFunded(), loadCharityExecuting()]);

  const onMarkExecuting = async (campaign) => {
    if (!window.confirm(
      `Mark campaign "${campaign.title}" as EXECUTING?\n` +
      `This will call the smart contract — wait up to ~30s for confirmation.`
    )) return;
    const key = `execute:${campaign.id}`;
    setCharityState((s) => ({ ...s, processingKey: key }));
    try {
      await charityService.markExecuting(campaign.id);
      toast.success("Campaign is now EXECUTING");
      await refreshCharityLists();
    } catch (e) {
      const msg = e?.code === "ECONNABORTED"
        ? "Request timed out. The transaction may still be processing on-chain — please reload in a moment."
        : (e?.response?.data?.message || "Failed to mark executing");
      toast.error(msg);
    } finally {
      setCharityState((s) => ({ ...s, processingKey: null }));
    }
  };

  const onForceFail = async (campaign) => {
    if (!window.confirm(
      `Force-fail campaign "${campaign.title}"?\n` +
      `Donors will be able to claim refund. This cannot be undone.\n` +
      `Wait up to ~30s for on-chain confirmation.`
    )) return;
    const key = `forceFail:${campaign.id}`;
    setCharityState((s) => ({ ...s, processingKey: key }));
    try {
      await charityService.adminForceFail(campaign.id);
      toast.success("Campaign force-failed");
      await refreshCharityLists();
    } catch (e) {
      const msg = e?.code === "ECONNABORTED"
        ? "Request timed out. The transaction may still be processing on-chain — please reload in a moment."
        : (e?.response?.data?.message || "Failed to force-fail");
      toast.error(msg);
    } finally {
      setCharityState((s) => ({ ...s, processingKey: null }));
    }
  };

  const onUnlockMilestone = async () => {
    const { campaignId, milestoneIdx, reportPostId } = charityState.unlockModal;
    const key = `unlock:${campaignId}:${milestoneIdx}`;
    setCharityState((s) => ({ ...s, processingKey: key }));
    try {
      await charityService.unlockMilestone(campaignId, milestoneIdx, reportPostId || null);
      toast.success(`Milestone ${milestoneIdx + 1} unlocked`);
      setCharityState((s) => ({ ...s, unlockModal: null, processingKey: null }));
      await refreshCharityLists();
    } catch (e) {
      const msg = e?.code === "ECONNABORTED"
        ? "Request timed out. The transaction may still be processing on-chain — please reload in a moment."
        : (e?.response?.data?.message || "Failed to unlock milestone");
      toast.error(msg);
      setCharityState((s) => ({ ...s, processingKey: null }));
    }
  };

  useEffect(() => {
    loadStats(7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "users") loadUsers({ page: 1 });
    if (tab === "moderation") {
      loadModerationPosts({ page: 1 });
      loadModerationComments({ page: 1 });
    }
    if (tab === "organizations") loadOrganizations({ page: 1 });
    if (tab === "charity") {
      loadCharityFunded();
      loadCharityExecuting();
    }
    if (tab === "audit") loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const loadOrganizations = async (patch = {}) => {
    const next = { ...orgsState, ...patch };
    try {
      setLoading(true);
      const res = await organizationService.adminList({
        status: next.status,
        page: next.page,
        limit: next.limit,
      });
      setOrgsState({
        ...next,
        items: res.organizations || [],
        total: res.pagination?.total || 0,
        totalPages: res.pagination?.totalPages || 1,
      });
    } catch (e) {
      toast.error(e?.message || "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOrg = async (org) => {
    try {
      await organizationService.adminVerify(org.id);
      toast.success("Organization verified. Official group chat created.");
      await loadOrganizations();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to verify");
    }
  };

  const onRejectOrg = async (org) => {
    const reason = window.prompt("Reject reason (optional):", "");
    if (reason === null) return; // cancelled
    try {
      await organizationService.adminReject(org.id, reason);
      toast.success("Organization rejected");
      await loadOrganizations();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to reject");
    }
  };

  const topPosts = useMemo(() => stats?.topPosts || [], [stats]);

  const onBanToggle = async (u) => {
    const status = String(u.status || "").toLowerCase();
    const isSuspended = status === "suspended";

    const targetRole = String(u.role || "user").toLowerCase();
    const isTargetAdmin = targetRole === "admin";
    const isSelf = String(u._id) === String(user?._id);

    if (isSelf) return toast.error("You cannot ban your own account.");
    if (isTargetAdmin) return toast.error("You cannot ban an admin account.");

    // optional: không cho ban khi đã suspended (thay vì chuyển Unban)
    // nếu bạn vẫn muốn toggle ban/unban thì bỏ đoạn này
    // if (isSuspended) return toast("This account is already suspended.");

    try {
      if (isSuspended) {
        await adminService.unbanUser(u._id);
        toast.success("Unsuspended");
      } else {
        await adminService.banUser(u._id);
        toast.success("Suspended");
      }
      await loadUsers();
    } catch (e) {
      toast.error(e?.message || "Action failed");
    }
  };

  const onRoleChange = async (u, roleValue) => {
    try {
      await adminService.setUserRole(u._id, roleValue);
      toast.success("Role updated");
      await loadUsers();
    } catch (e) {
      toast.error(e?.message || "Failed to update role");
    }
  };

  const onDeleteRestorePost = async (p) => {
    try {
      if (p.deleted) {
        await adminService.restorePost(p._id);
        toast.success("Post restored");
      } else {
        await adminService.deletePost(p._id);
        toast.success("Post deleted (soft)");
      }
      await loadModerationPosts();
    } catch (e) {
      toast.error(e?.message || "Failed");
    }
  };

  const onDeleteRestoreComment = async (c) => {
    try {
      if (c.deleted) {
        await adminService.restoreComment(c._id);
        toast.success("Comment restored");
      } else {
        await adminService.deleteComment(c._id);
        toast.success("Comment deleted (soft)");
      }
      await loadModerationComments();
    } catch (e) {
      toast.error(e?.message || "Failed");
    }
  };

  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Admin Dashboard</h1>
          <div className="admin-subtitle">
            Logged in as <b>{user?.username}</b> ({role})
          </div>
        </div>

        <div className="admin-actions">
          <select
            className="admin-select"
            value={days}
            onChange={(e) => {
              const d = Number(e.target.value);
              setDays(d);
              loadStats(d);
            }}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>

          <button
            className="admin-btn primary"
            onClick={() => loadStats(days)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <Tabs tab={tab} setTab={setTab} />

      {tab === "overview" ? (
        <div className="admin-grid">
          <div className="admin-cards">
            <StatCard
              title="Total users"
              value={stats?.summary?.totalUsers ?? "—"}
            />
            <StatCard
              title="New users (7d)"
              value={stats?.summary?.newUsers7 ?? "—"}
            />
            <StatCard
              title="Active users"
              value={stats?.summary?.activeUsers ?? "—"}
              hint="DAU/WAU approx based on activity"
            />
            <StatCard title="Posts" value={stats?.summary?.totalPosts ?? "—"} />
            <StatCard
              title="Comments"
              value={stats?.summary?.totalComments ?? "—"}
            />
            <StatCard
              title="Likes (posts)"
              value={stats?.summary?.totalLikes ?? "—"}
            />
          </div>

          <div className="admin-charts">
            <MiniBarChart
              title="Users created"
              series={stats?.series?.users || []}
              valueKey="users"
            />
            <MiniBarChart
              title="Posts created"
              series={stats?.series?.posts || []}
              valueKey="posts"
            />
          </div>

          <div className="admin-section">
            <div className="admin-section-title">Top posts (by likes)</div>
            <div className="admin-table">
              <div className="admin-row admin-head default">
                <div>Post</div>
                <div>Likes</div>
                <div>Comments</div>
                <div>Author</div>
                <div>Created</div>
              </div>
              {topPosts.length === 0 ? (
                <div className="admin-row admin-empty default">No data</div>
              ) : (
                topPosts.map((x) => (
                  <div key={String(x.postId)} className="admin-row default">
                    <div className="admin-cell">
                      <div className="admin-ellipsis">
                        {x.post?.caption || "(no caption)"}
                      </div>
                      <div className="admin-muted">
                        #{String(x.postId).slice(-8)}
                      </div>
                    </div>
                    <div>{x.likes}</div>
                    <div>{x.comments}</div>
                    <div>{x.post?.userId?.username || "—"}</div>
                    <div>{formatDateTime(x.post?.createdAt)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "users" ? (
        <div className="admin-section">
          <div className="admin-section-title">User management</div>

          <div className="admin-filters">
            <input
              className="admin-input"
              placeholder="Search username/email/fullName..."
              value={usersState.q}
              onChange={(e) =>
                setUsersState((s) => ({ ...s, q: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") loadUsers({ page: 1 });
              }}
            />
            <select
              className="admin-select"
              value={usersState.status}
              onChange={(e) => loadUsers({ status: e.target.value, page: 1 })}
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <select
              className="admin-select"
              value={usersState.role}
              onChange={(e) => loadUsers({ role: e.target.value, page: 1 })}
            >
              <option value="all">All roles</option>
              <option value="user">User</option>
              <option value="mod">Mod</option>
              <option value="admin">Admin</option>
            </select>
            <select
              className="admin-select"
              value={usersState.verified}
              onChange={(e) => loadUsers({ verified: e.target.value, page: 1 })}
            >
              <option value="all">All verification</option>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>

            <button
              className="admin-btn"
              onClick={() => loadUsers({ page: 1 })}
              disabled={loading}
            >
              Search
            </button>
          </div>

          <div className="admin-table">
            <div className="admin-row admin-head users">
              <div>User</div>
              <div>Email</div>
              <div>Status</div>
              <div>Role</div>
              <div>Verified</div>
              <div>Created</div>
              <div>Last login</div>
              <div>Actions</div>
            </div>

            {usersState.users.length === 0 ? (
              <div className="admin-row admin-empty">No users</div>
            ) : (
              usersState.users.map((u) => {
                const status = String(u.status || "").toLowerCase();
                const isSuspended = status === "suspended";
                const isActive = status === "active";

                const targetRole = String(u.role || "user").toLowerCase();
                const isTargetAdmin = targetRole === "admin";
                const isSelf = String(u._id) === String(user?._id);

                const canBan = isAdmin && !isTargetAdmin && !isSelf;
                const canEditRole =
                  isAdmin && String(u._id) !== String(user?._id);

                return (
                  <div className="admin-row users" key={u._id}>
                    <div className="admin-cell">
                      <div className="admin-ellipsis">
                        {u.fullName ? `${u.fullName} ` : ""}
                        <span className="admin-muted">@{u.username}</span>
                      </div>
                      <div className="admin-muted">
                        #{String(u._id).slice(-8)}
                      </div>
                    </div>
                    <div className="admin-ellipsis">{u.email}</div>
                    <div>
                      <span
                        className={`admin-pill ${isActive ? "ok" : "danger"}`}
                      >
                        {u.status || "—"}
                      </span>
                    </div>
                    <div>
                      {canEditRole ? (
                        <select
                          className="admin-select small"
                          value={u.role || "user"}
                          onChange={(e) => onRoleChange(u, e.target.value)}
                        >
                          <option value="user">user</option>
                          <option value="mod">mod</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : (
                        <span
                          className={`admin-pill ${isActive ? "ok" : "danger"}`}
                        >
                          {u.status || "—"}
                        </span>
                      )}
                    </div>
                    <div>{u.isEmailVerified ? "✅" : "❌"}</div>
                    <div>{formatDateTime(u.createdAt)}</div>
                    <div>{formatDateTime(u.lastLoginAt)}</div>
                    <div className="admin-actions-inline">
                      <button
                        className={`admin-btn ${isSuspended ? "ok" : "danger"}`}
                        onClick={() => onBanToggle(u)}
                        disabled={!canBan}
                        title={
                          !canBan
                            ? isSelf
                              ? "You cannot ban yourself"
                              : isTargetAdmin
                                ? "You cannot ban an admin"
                                : "Not allowed"
                            : ""
                        }
                      >
                        {isSuspended ? "Unban" : "Ban"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Pagination
            page={usersState.page}
            totalPages={usersState.totalPages}
            onPage={(p) => loadUsers({ page: p })}
          />
        </div>
      ) : null}

      {tab === "moderation" ? (
        <div className="admin-grid2">
          <div className="admin-section">
            <div className="admin-section-title">
              Posts moderation (soft delete)
            </div>
            <div className="admin-filters">
              <input
                className="admin-input"
                placeholder="Search caption/location..."
                value={modState.posts.q}
                onChange={(e) =>
                  setModState((s) => ({
                    ...s,
                    posts: { ...s.posts, q: e.target.value },
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadModerationPosts({ page: 1 });
                }}
              />
              <select
                className="admin-select"
                value={modState.posts.status}
                onChange={(e) =>
                  loadModerationPosts({ status: e.target.value, page: 1 })
                }
              >
                <option value="active">Active</option>
                <option value="deleted">Deleted</option>
                <option value="all">All</option>
              </select>
              <button
                className="admin-btn"
                onClick={() => loadModerationPosts({ page: 1 })}
              >
                Search
              </button>
            </div>

            <div className="admin-table">
              <div className="admin-row admin-head">
                <div>Caption</div>
                <div>Author</div>
                <div>Status</div>
                <div>Created</div>
                <div>Action</div>
              </div>

              {modState.posts.items.length === 0 ? (
                <div className="admin-row admin-empty">No posts</div>
              ) : (
                modState.posts.items.map((p) => (
                  <div className="admin-row posts" key={p._id}>
                    <div className="admin-cell">
                      <div className="admin-ellipsis">
                        {p.caption || "(no caption)"}
                      </div>
                      <div className="admin-muted">
                        #{String(p._id).slice(-8)}
                      </div>
                    </div>
                    <div>{p.userId?.username || "—"}</div>
                    <div>
                      <span
                        className={`admin-pill ${p.deleted ? "danger" : "ok"}`}
                      >
                        {p.deleted ? "deleted" : "active"}
                      </span>
                    </div>
                    <div>{formatDateTime(p.createdAt)}</div>
                    <div>
                      <button
                        className={`admin-btn ${p.deleted ? "" : "danger"}`}
                        onClick={() => onDeleteRestorePost(p)}
                      >
                        {p.deleted ? "Restore" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Pagination
              page={modState.posts.page}
              totalPages={modState.posts.totalPages}
              onPage={(p) => loadModerationPosts({ page: p })}
            />
          </div>

          <div className="admin-section">
            <div className="admin-section-title">
              Comments moderation (soft delete)
            </div>
            <div className="admin-filters">
              <input
                className="admin-input"
                placeholder="Search comment content..."
                value={modState.comments.q}
                onChange={(e) =>
                  setModState((s) => ({
                    ...s,
                    comments: { ...s.comments, q: e.target.value },
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadModerationComments({ page: 1 });
                }}
              />
              <select
                className="admin-select"
                value={modState.comments.status}
                onChange={(e) =>
                  loadModerationComments({ status: e.target.value, page: 1 })
                }
              >
                <option value="active">Active</option>
                <option value="deleted">Deleted</option>
                <option value="all">All</option>
              </select>
              <button
                className="admin-btn"
                onClick={() => loadModerationComments({ page: 1 })}
              >
                Search
              </button>
            </div>

            <div className="admin-table">
              <div className="admin-row admin-head">
                <div>Comment</div>
                <div>Author</div>
                <div>Status</div>
                <div>Created</div>
                <div>Action</div>
              </div>

              {modState.comments.items.length === 0 ? (
                <div className="admin-row admin-empty">No comments</div>
              ) : (
                modState.comments.items.map((c) => (
                  <div className="admin-row comments" key={c._id}>
                    <div className="admin-cell">
                      <div className="admin-ellipsis">
                        {c.content || "(empty)"}
                      </div>
                      <div className="admin-muted">
                        #{String(c._id).slice(-8)}
                      </div>
                    </div>
                    <div>{c.userId?.username || "—"}</div>
                    <div>
                      <span
                        className={`admin-pill ${c.deleted ? "danger" : "ok"}`}
                      >
                        {c.deleted ? "deleted" : "active"}
                      </span>
                    </div>
                    <div>{formatDateTime(c.createdAt)}</div>
                    <div>
                      <button
                        className={`admin-btn ${c.deleted ? "" : "danger"}`}
                        onClick={() => onDeleteRestoreComment(c)}
                      >
                        {c.deleted ? "Restore" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Pagination
              page={modState.comments.page}
              totalPages={modState.comments.totalPages}
              onPage={(p) => loadModerationComments({ page: p })}
            />
          </div>
        </div>
      ) : null}

      {tab === "organizations" ? (
        <div className="admin-section">
          <div className="admin-section-title">Organization applications</div>
          <div className="admin-filters">
            <select
              className="admin-select"
              value={orgsState.status}
              onChange={(e) =>
                loadOrganizations({ status: e.target.value, page: 1 })
              }
            >
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
            <button
              className="admin-btn"
              onClick={() => loadOrganizations({ page: 1 })}
            >
              Reload
            </button>
          </div>

          <div className="admin-table">
            <div className="admin-row admin-head organizations">
              <div>Name</div>
              <div>Owner</div>
              <div>Wallet</div>
              <div>Status</div>
              <div>Track record</div>
              <div>Applied</div>
              <div>Action</div>
            </div>

            {orgsState.items.length === 0 ? (
              <div className="admin-row admin-empty">No organizations</div>
            ) : (
              orgsState.items.map((o) => {
                const docs = Array.isArray(o.proofDocuments) ? o.proofDocuments : [];
                const docCount = docs.length;
                const isExpanded = expandedOrgId === o.id;
                const stats = o.campaignStats || null;
                return (
                  <React.Fragment key={o.id}>
                    <div className="admin-row organizations">
                      <div className="admin-cell">
                        <div className="admin-ellipsis">{o.name}</div>
                        <div className="admin-muted">/{o.slug}</div>
                      </div>
                      <div className="admin-ellipsis">
                        {o.owner?.username || "—"}
                      </div>
                      <div className="admin-ellipsis" title={o.walletAddress}>
                        <code style={{ fontSize: 11 }}>
                          {o.walletAddress
                            ? `${o.walletAddress.slice(0, 6)}...${o.walletAddress.slice(-4)}`
                            : "—"}
                        </code>
                      </div>
                      <div>
                        <span
                          className={`admin-pill ${
                            o.status === "verified"
                              ? "ok"
                              : o.status === "rejected"
                                ? "danger"
                                : ""
                          }`}
                        >
                          {o.status}
                        </span>
                      </div>
                      <div className="admin-trackrecord">
                        {stats ? (
                          stats.total === 0 ? (
                            <span className="admin-muted" style={{ fontSize: 12 }}>
                              No campaigns yet
                            </span>
                          ) : (
                            <div className="admin-trackrecord-line">
                              <span title="Total campaigns" className="admin-pill">
                                {stats.total} total
                              </span>
                              {stats.COMPLETED > 0 && (
                                <span className="admin-pill ok" title="Completed">
                                  ✓ {stats.COMPLETED}
                                </span>
                              )}
                              {stats.EXECUTING > 0 && (
                                <span className="admin-pill" title="Executing">
                                  ⚙ {stats.EXECUTING}
                                </span>
                              )}
                              {(stats.OPEN + stats.FUNDED) > 0 && (
                                <span className="admin-pill" title="Open + Funded">
                                  ◷ {stats.OPEN + stats.FUNDED}
                                </span>
                              )}
                              {(stats.FAILED + stats.REFUNDED) > 0 && (
                                <span
                                  className="admin-pill danger"
                                  title="Failed + Refunded"
                                >
                                  ✕ {stats.FAILED + stats.REFUNDED}
                                </span>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="admin-muted" style={{ fontSize: 12 }}>
                            —
                          </span>
                        )}
                      </div>
                      <div>{formatDateTime(o.createdAt)}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          className="admin-btn"
                          onClick={() =>
                            setExpandedOrgId(isExpanded ? null : o.id)
                          }
                          disabled={docCount === 0}
                          title={
                            docCount === 0
                              ? "No proof documents uploaded"
                              : isExpanded
                                ? "Hide documents"
                                : "View documents inline"
                          }
                        >
                          {isExpanded ? "Hide" : "Docs"} ({docCount})
                        </button>
                        {o.status === "pending" && (
                          <>
                            <button
                              className="admin-btn"
                              onClick={() => onVerifyOrg(o)}
                            >
                              Verify
                            </button>
                            <button
                              className="admin-btn danger"
                              onClick={() => onRejectOrg(o)}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {o.status === "rejected" && (
                          <span className="admin-muted" style={{ fontSize: 12 }}>
                            {o.rejectedReason || "No reason"}
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="admin-row admin-expand-row">
                        <div className="admin-expand-panel">
                          <div className="admin-expand-title">
                            Proof documents ({docCount})
                            <span className="admin-muted" style={{ marginLeft: 8 }}>
                              — review inline before verifying. Uploads are
                              Cloudinary-hosted; PDFs render in &lt;iframe&gt;,
                              images inline.
                            </span>
                          </div>
                          {docCount === 0 ? (
                            <div className="admin-muted">
                              No proof documents uploaded by this organization.
                            </div>
                          ) : (
                            <div className="admin-doc-grid">
                              {docs.map((url, i) => {
                                const img = isImageUrl(url);
                                const pdf = isPdfUrl(url);
                                return (
                                  <div className="admin-doc-card" key={i}>
                                    <div className="admin-doc-card-head">
                                      <span className="admin-doc-card-label">
                                        #{i + 1} {img ? "Image" : pdf ? "PDF" : "File"}
                                      </span>
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="admin-link"
                                        style={{ fontSize: 12 }}
                                      >
                                        Open in new tab ↗
                                      </a>
                                    </div>
                                    <div className="admin-doc-card-body">
                                      {img ? (
                                        <img
                                          src={url}
                                          alt={`Proof ${i + 1}`}
                                          loading="lazy"
                                        />
                                      ) : pdf ? (
                                        <iframe
                                          src={url}
                                          title={`Proof ${i + 1}`}
                                          width="100%"
                                          height="500"
                                        />
                                      ) : (
                                        <div className="admin-muted">
                                          Unsupported preview format. Use the
                                          link above to download.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </div>

          <Pagination
            page={orgsState.page}
            totalPages={orgsState.totalPages}
            onPage={(p) => loadOrganizations({ page: p })}
          />
        </div>
      ) : null}

      {tab === "charity" ? (
        <div className="admin-grid2">
          {/* Panel 1: campaigns — filter mặc định FUNDED, đổi qua dropdown để debug */}
          <div className="admin-section">
            <div className="admin-section-title">
              Campaigns awaiting execution
              <span className="admin-pill" style={{ marginLeft: 8 }}>
                {charityState.fundedFilter}
              </span>
            </div>
            <div className="admin-filters">
              <select
                className="admin-select"
                value={charityState.fundedFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  setCharityState((s) => ({ ...s, fundedFilter: v }));
                  loadCharityFunded(v);
                }}
              >
                <option value="FUNDED">FUNDED (chờ execute)</option>
                <option value="OPEN">OPEN (đang gây quỹ)</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="FAILED">FAILED</option>
                <option value="ALL">All statuses (debug)</option>
              </select>
              <button
                className="admin-btn"
                onClick={() => refreshCharityLists()}
                disabled={charityState.loadingFunded || charityState.loadingExecuting}
              >
                Reload
              </button>
            </div>
            <div className="admin-table">
              <div className="admin-row admin-head">
                <div>Campaign</div>
                <div>Organization</div>
                <div>Goal (ETH)</div>
                <div>Raised (ETH)</div>
                <div>Status</div>
                <div>Actions</div>
              </div>
              {charityState.loadingFunded ? (
                <div className="admin-row admin-empty">Loading...</div>
              ) : charityState.funded.length === 0 ? (
                <div className="admin-row admin-empty">
                  No campaigns matching filter
                </div>
              ) : (
                charityState.funded.map((c) => {
                  const goalEth = ethers.formatEther(c.goalWei || "0");
                  const raisedEth = ethers.formatEther(c.raisedWei || "0");
                  const isFunded = c.status === "FUNDED";
                  const executingKey = `execute:${c.id}`;
                  const failKey = `forceFail:${c.id}`;
                  const isExecuting = charityState.processingKey === executingKey;
                  const isFailing = charityState.processingKey === failKey;
                  const anyProcessing = !!charityState.processingKey;
                  const isExpanded = expandedCampaignId === c.id;
                  const milestones = c.milestones || [];

                  // Tính warning trên milestone plan — legacy campaign (tạo
                  // trước khi thêm rule MIN/MAX %) có thể vi phạm; hiển thị
                  // warning để admin biết rủi ro trước khi markExecuting.
                  let sumPct = 0;
                  let hasOverPercent = false;
                  for (const m of milestones) {
                    const p = milestonePercent(m.amountWei, c.goalWei);
                    sumPct += p;
                    if (p > MAX_MILESTONE_PERCENT + 0.001) hasOverPercent = true;
                  }
                  const sumOff = Math.abs(sumPct - 100) > 0.05;
                  const tooFew = milestones.length < 2;
                  const hasWarning = hasOverPercent || sumOff || tooFew;

                  return (
                    <React.Fragment key={c.id}>
                      <div
                        className="admin-row"
                        style={{ gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 1.6fr" }}
                      >
                        <div className="admin-cell">
                          <Link to={`/charity/${c.id}`} className="admin-link">
                            <div className="admin-ellipsis">{c.title}</div>
                          </Link>
                          <div className="admin-muted">
                            #{String(c.id).slice(-8)} • {milestones.length} milestone(s)
                            {hasWarning && (
                              <span
                                className="admin-pill danger"
                                style={{ marginLeft: 6, fontSize: 10 }}
                                title="Milestone plan has issues — click View milestones"
                              >
                                ⚠ check plan
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="admin-ellipsis">
                          {c.organization?.name || "—"}
                        </div>
                        <div>{goalEth}</div>
                        <div>{raisedEth}</div>
                        <div>
                          <span className="admin-pill">{c.status}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            className="admin-btn"
                            onClick={() =>
                              setExpandedCampaignId(isExpanded ? null : c.id)
                            }
                            disabled={milestones.length === 0}
                          >
                            {isExpanded ? "Hide plan" : "View plan"}
                          </button>
                          {isFunded && (
                            <>
                              <button
                                className="admin-btn"
                                onClick={() => onMarkExecuting(c)}
                                disabled={anyProcessing}
                              >
                                {isExecuting ? "Processing..." : "Mark Executing"}
                              </button>
                              <button
                                className="admin-btn danger"
                                onClick={() => onForceFail(c)}
                                disabled={anyProcessing}
                              >
                                {isFailing ? "Processing..." : "Force Fail"}
                              </button>
                            </>
                          )}
                          {!isFunded && (
                            <span className="admin-muted" style={{ fontSize: 12 }}>
                              No actions for {c.status}
                            </span>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="admin-row admin-expand-row">
                          <div className="admin-expand-panel">
                            <div className="admin-expand-title">
                              Milestone plan ({milestones.length})
                              <span className="admin-muted" style={{ marginLeft: 8 }}>
                                — verify the breakdown before unlocking funds.
                                Rule: ≥ 2 mốc, ≤ {MAX_MILESTONE_PERCENT}% per
                                mốc, sum = 100%.
                              </span>
                            </div>

                            {hasWarning && (
                              <div className="admin-warn-banner">
                                <b>⚠ Plan does not match safe milestone rules:</b>
                                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                                  {tooFew && (
                                    <li>
                                      Only {milestones.length} milestone — rule
                                      requires at least 2.
                                    </li>
                                  )}
                                  {hasOverPercent && (
                                    <li>
                                      One or more milestones exceed{" "}
                                      {MAX_MILESTONE_PERCENT}% of the goal.
                                    </li>
                                  )}
                                  {sumOff && (
                                    <li>
                                      Sum of milestone amounts is{" "}
                                      {sumPct.toFixed(2)}% of goal (expected
                                      100%). Likely a legacy campaign created
                                      before the milestone rules were enforced.
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}

                            <div className="admin-table">
                              <div
                                className="admin-row admin-head"
                                style={{
                                  gridTemplateColumns: "0.4fr 2.5fr 1fr 1fr 1.4fr",
                                }}
                              >
                                <div>#</div>
                                <div>Title</div>
                                <div>Amount (ETH)</div>
                                <div>% of goal</div>
                                <div>Bar</div>
                              </div>
                              {milestones.map((m, idx) => {
                                const amountEth = ethers.formatEther(
                                  m.amountWei || "0"
                                );
                                const pct = milestonePercent(
                                  m.amountWei,
                                  c.goalWei
                                );
                                const over = pct > MAX_MILESTONE_PERCENT + 0.001;
                                return (
                                  <div
                                    className="admin-row"
                                    key={idx}
                                    style={{
                                      gridTemplateColumns: "0.4fr 2.5fr 1fr 1fr 1.4fr",
                                    }}
                                  >
                                    <div>#{idx + 1}</div>
                                    <div className="admin-cell">
                                      <div className="admin-ellipsis">{m.title}</div>
                                      {m.description && (
                                        <div
                                          className="admin-muted"
                                          style={{ fontSize: 11 }}
                                        >
                                          {m.description}
                                        </div>
                                      )}
                                    </div>
                                    <div>{amountEth}</div>
                                    <div>
                                      <span
                                        className={`admin-pill ${over ? "danger" : ""}`}
                                      >
                                        {pct.toFixed(2)}%
                                      </span>
                                    </div>
                                    <div className="admin-pct-bar">
                                      <div
                                        className={`admin-pct-bar-fill ${over ? "danger" : ""}`}
                                        style={{
                                          width: `${Math.min(100, pct * 2)}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                              <div
                                className="admin-row"
                                style={{
                                  gridTemplateColumns: "0.4fr 2.5fr 1fr 1fr 1.4fr",
                                  fontWeight: 600,
                                }}
                              >
                                <div>Σ</div>
                                <div className="admin-muted">Total</div>
                                <div>{ethers.formatEther(c.goalWei || "0")}</div>
                                <div>
                                  <span
                                    className={`admin-pill ${sumOff ? "danger" : "ok"}`}
                                  >
                                    {sumPct.toFixed(2)}%
                                  </span>
                                </div>
                                <div className="admin-muted">
                                  {sumOff ? "≠ 100%" : "= 100% ✓"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>

          {/* Panel 2: EXECUTING campaigns — group milestones theo campaign */}
          <div className="admin-section">
            <div className="admin-section-title">
              Campaigns awaiting milestone unlock
              <span className="admin-pill ok" style={{ marginLeft: 8 }}>
                EXECUTING
              </span>
            </div>
            {charityState.loadingExecuting ? (
              <div className="admin-row admin-empty">Loading...</div>
            ) : charityState.executing.length === 0 ? (
              <div className="admin-row admin-empty">No EXECUTING campaigns</div>
            ) : (
              charityState.executing.map((c) => {
                const failKey = `forceFail:${c.id}`;
                const isFailing = charityState.processingKey === failKey;
                const anyProcessing = !!charityState.processingKey;
                const unlockedCount = (c.milestones || []).filter(
                  (m) => m.unlocked
                ).length;
                const totalMs = (c.milestones || []).length;
                return (
                  <div key={c.id} className="admin-campaign-group">
                    <div className="admin-campaign-group-header">
                      <div>
                        <Link
                          to={`/charity/${c.id}`}
                          className="admin-link admin-campaign-group-title"
                        >
                          {c.title}
                        </Link>
                        <div className="admin-muted" style={{ fontSize: 12 }}>
                          {c.organization?.name || "—"} • #
                          {String(c.id).slice(-8)} • Milestones {unlockedCount}/
                          {totalMs}
                        </div>
                      </div>
                      <button
                        className="admin-btn danger"
                        onClick={() => onForceFail(c)}
                        disabled={anyProcessing || unlockedCount > 0}
                        title={
                          unlockedCount > 0
                            ? "Cannot force-fail after a milestone has been disbursed"
                            : ""
                        }
                      >
                        {isFailing ? "Processing..." : "Force Fail"}
                      </button>
                    </div>

                    <div className="admin-table">
                      <div className="admin-row admin-head">
                        <div>Milestone</div>
                        <div>Amount (ETH)</div>
                        <div>Status</div>
                        <div>Action</div>
                      </div>
                      {(c.milestones || []).map((m, idx) => {
                        const amountEth = ethers.formatEther(m.amountWei || "0");
                        const unlockKey = `unlock:${c.id}:${idx}`;
                        const isUnlocking =
                          charityState.processingKey === unlockKey;
                        return (
                          <div
                            className="admin-row"
                            key={`${c.id}-${idx}`}
                            style={{
                              gridTemplateColumns: "3fr 1fr 1fr 1.5fr",
                            }}
                          >
                            <div className="admin-cell">
                              <div className="admin-ellipsis">
                                #{idx + 1} {m.title}
                              </div>
                              {m.description && (
                                <div
                                  className="admin-muted"
                                  style={{ fontSize: 11 }}
                                >
                                  {m.description}
                                </div>
                              )}
                              {m.reportPostId && (
                                <Link
                                  to={`/post/${m.reportPostId}`}
                                  className="admin-link"
                                  style={{ fontSize: 11 }}
                                >
                                  View report post
                                </Link>
                              )}
                            </div>
                            <div>{amountEth}</div>
                            <div>
                              {m.unlocked ? (
                                <span className="admin-pill ok">Unlocked</span>
                              ) : (
                                <span className="admin-pill">Pending</span>
                              )}
                            </div>
                            <div>
                              {m.unlocked ? (
                                m.unlockedTxHash ? (
                                  <a
                                    href={`${SEPOLIA_ETHERSCAN_BASE}/tx/${m.unlockedTxHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="admin-link"
                                    style={{ fontSize: 12 }}
                                  >
                                    View tx
                                  </a>
                                ) : null
                              ) : (
                                <button
                                  className="admin-btn"
                                  disabled={anyProcessing}
                                  onClick={() =>
                                    setCharityState((s) => ({
                                      ...s,
                                      unlockModal: {
                                        campaignId: c.id,
                                        campaignTitle: c.title,
                                        milestoneIdx: idx,
                                        milestoneTitle: m.title,
                                        reportPostId: "",
                                      },
                                    }))
                                  }
                                >
                                  {isUnlocking ? "Processing..." : "Unlock"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Unlock milestone modal */}
          {charityState.unlockModal && (
            <div
              className="admin-modal-backdrop"
              onClick={() => {
                if (charityState.processingKey) return;
                setCharityState((s) => ({ ...s, unlockModal: null }));
              }}
            >
              <div
                className="admin-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="admin-modal-title">
                  Unlock Milestone #
                  {(charityState.unlockModal.milestoneIdx || 0) + 1}
                </div>
                <div className="admin-modal-subtitle">
                  Campaign: <b>{charityState.unlockModal.campaignTitle}</b>
                  <br />
                  Milestone: <b>{charityState.unlockModal.milestoneTitle}</b>
                </div>
                <div className="admin-modal-field">
                  <label className="admin-modal-label">
                    Report Post ID{" "}
                    <span className="admin-muted">
                      (optional — Mongo _id của post báo cáo)
                    </span>
                  </label>
                  <input
                    className="admin-input"
                    placeholder="6452ab..."
                    value={charityState.unlockModal.reportPostId || ""}
                    onChange={(e) =>
                      setCharityState((s) => ({
                        ...s,
                        unlockModal: {
                          ...s.unlockModal,
                          reportPostId: e.target.value,
                        },
                      }))
                    }
                    disabled={!!charityState.processingKey}
                  />
                </div>
                <div className="admin-modal-note">
                  This will call <code>unlockMilestone</code> on the Charity
                  smart contract.
                  <br />
                  ETH will be transferred to the beneficiary wallet. This is
                  irreversible. Wait up to ~30s for confirmation.
                </div>
                <div className="admin-modal-actions">
                  <button
                    className="admin-btn"
                    onClick={() =>
                      setCharityState((s) => ({ ...s, unlockModal: null }))
                    }
                    disabled={!!charityState.processingKey}
                  >
                    Cancel
                  </button>
                  <button
                    className="admin-btn primary"
                    onClick={onUnlockMilestone}
                    disabled={!!charityState.processingKey}
                  >
                    {charityState.processingKey?.startsWith("unlock:")
                      ? "Processing..."
                      : "Confirm Unlock"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === "audit" ? (
        <div className="admin-section">
          <div className="admin-section-title">Audit log</div>
          {!canSeeAudit ? (
            <div className="admin-note">
              Only <b>admin</b> can view audit logs.
            </div>
          ) : (
            <div className="admin-table">
              <div className="admin-row admin-head">
                <div>Time</div>
                <div>Actor</div>
                <div>Action</div>
                <div>Target</div>
                <div>Details</div>
              </div>

              {audit.length === 0 ? (
                <div className="admin-row admin-empty">
                  No logs (AuditLog model not enabled, or no actions yet)
                </div>
              ) : (
                audit.map((l) => (
                  <div className="admin-row audit" key={l._id}>
                    <div>{formatDateTime(l.createdAt)}</div>
                    <div className="admin-ellipsis">
                      {l.actorUsername || l.actorId || "—"}
                    </div>
                    <div>
                      <span className="admin-pill">{l.action}</span>
                    </div>
                    <div className="admin-ellipsis">
                      {l.targetType}:{String(l.targetId || "").slice(-8)}
                    </div>
                    <div className="admin-ellipsis">
                      {JSON.stringify(l.details || {})}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
