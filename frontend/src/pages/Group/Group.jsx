import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import CreateGroupModal from "../../components/CreateGroupModal/CreateGroupModal";
import VerifiedBadge from "../../components/VerifiedBadge/VerifiedBadge";
import { groupService } from "../../api";
import { showError, showSuccess } from "../../utils/toast";
import "./Group.css";

function Group() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [myGroups, setMyGroups] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningGroupId, setJoiningGroupId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchGroupsData() {
      try {
        setLoading(true);
        const [joinedRes, suggestedRes] = await Promise.all([
          groupService.getJoinedGroups(),
          groupService.getSuggestedGroups(),
        ]);

        if (mounted) {
          if (joinedRes?.success) setMyGroups(joinedRes.groups || []);
          if (suggestedRes?.success) setSuggested(suggestedRes.groups || []);
        }
      } catch (err) {
        showError("Failed to load groups");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchGroupsData();
    return () => (mounted = false);
  }, []);

  function handleGroupCreated(newGroup) {
    if (!newGroup) return;
    setMyGroups((prev) => [newGroup, ...prev]);
    setSuggested((prev) => prev.filter((group) => group.id !== newGroup.id));
  }

  async function handleJoinGroup(e, groupId) {
    e.stopPropagation();
    try {
      setJoiningGroupId(groupId);
      const response = await groupService.joinGroup(groupId);
      if (response?.success && response.group) {
        const joinedGroup = response.group;
        setMyGroups((prev) => {
          const exists = prev.some((group) => group.id === joinedGroup.id);
          return exists ? prev : [joinedGroup, ...prev];
        });
        setSuggested((prev) => prev.filter((group) => group.id !== groupId));
        showSuccess("Joined group successfully");
      }
    } catch (err) {
      showError("Failed to join group");
    } finally {
      setJoiningGroupId(null);
    }
  }

  return (
    <div className="group-page">
      <Sidebar />
      <div className="group-content-wrapper">
        <Header />
        <main className="group-main">
          {/* Button tạo Group */}
          <section className="group-header">
            <h1>Groups</h1>
            <button
              className="btn-create-group"
              onClick={() => setIsModalOpen(true)}
            >
              + {t("group.createGroup", "Create Group")}
            </button>
          </section>

          <div className="group-container">
            {/* Cột trái: Các group đã tham gia */}
            <div className="group-left">
              <section className="my-groups">
                <h2>
                  {t("group.myGroups", "My Groups")} ({myGroups.length})
                </h2>
                <div className="groups-list">
                  {loading && <p className="empty-state">Loading groups...</p>}
                  {myGroups.map((group) => (
                    <div
                      key={group.id}
                      className="group-item"
                      onClick={() => navigate(`/groups/${group.id}`)}
                      role="button"
                      tabIndex={0}
                    >
                      <img
                        src={group.image || "/images/default-avatar.jpg"}
                        alt={group.name}
                        className="group-item-img"
                      />
                      <div className="group-item-info">
                        <h3>
                          {group.name}
                          {group.organizationId && (
                            <VerifiedBadge
                              size="sm"
                              title={t(
                                "group.officialBadge",
                                "Official organization group",
                              )}
                            />
                          )}
                        </h3>
                        <p>{group.description}</p>
                        <span className="group-members">
                          {group.members} {t("group.members", "members")}
                        </span>
                      </div>
                    </div>
                  ))}
                  {myGroups.length === 0 && !loading && (
                    <p className="empty-state">
                      {t(
                        "group.noJoinedGroups",
                        "You haven't joined any groups yet.",
                      )}
                    </p>
                  )}
                </div>
              </section>
            </div>

            {/* Cột phải: Gợi ý các group */}
            <aside className="group-right">
              <section className="suggested-groups">
                <h2>{t("group.suggestedGroups", "Suggested Groups")}</h2>
                <div className="suggested-list">
                  {suggested.map((group) => (
                    <div key={group.id} className="suggested-item">
                      <Link to={`/groups/${group.id}`}>
                        <img
                          src={group.image || "/images/default-avatar.jpg"}
                          alt={group.name}
                          className="suggested-img"
                        />
                      </Link>
                      <div className="suggested-info">
                        <h4>
                          <Link to={`/groups/${group.id}`}>{group.name}</Link>
                          {group.organizationId && (
                            <VerifiedBadge
                              size="sm"
                              title={t(
                                "group.officialBadge",
                                "Official organization group",
                              )}
                            />
                          )}
                        </h4>
                        <p className="suggested-desc">{group.description}</p>
                        <span className="suggested-members">
                          {group.members} {t("group.members", "members")}
                        </span>
                        <button
                          className="btn-join"
                          onClick={(e) => handleJoinGroup(e, group.id)}
                          disabled={joiningGroupId === group.id}
                        >
                          {joiningGroupId === group.id
                            ? t("group.joining", "Joining...")
                            : t("group.join", "Join")}
                        </button>
                      </div>
                    </div>
                  ))}
                  {suggested.length === 0 && (
                    <p className="empty-state">
                      {t(
                        "group.noSuggestions",
                        "No more groups to suggest.",
                      )}
                    </p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </main>
      </div>

      {/* Modal tạo Group */}
      <CreateGroupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGroupCreated={handleGroupCreated}
      />
    </div>
  );
}

export default Group;
