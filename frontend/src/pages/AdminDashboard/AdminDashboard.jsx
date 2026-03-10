import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import adminService from "../../api/adminService";
import { useAuth } from "../../contexts/AuthContext";
import "./AdminDashboard.css";

const formatDateTime = (d) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleString();
  } catch {
    return "—";
  }
};

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

  // Audit
  const [audit, setAudit] = useState([]);

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
    if (tab === "audit") loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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
