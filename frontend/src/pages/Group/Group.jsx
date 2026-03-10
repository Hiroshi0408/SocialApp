import { useState, useEffect } from "react";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import CreateGroupModal from "../../components/CreateGroupModal/CreateGroupModal";
import PostCard from "../../components/PostCard/PostCard";
import {
  joinedGroups,
  suggestedGroups,
  groupPosts,
} from "../../data/mock-data";
import axios from "axios";
import "./Group.css";

function Group() {
  const [myGroups, setMyGroups] = useState(joinedGroups || []);
  const [suggested, setSuggested] = useState(suggestedGroups || []);
  const [posts, setPosts] = useState(groupPosts || []);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function fetchGroupsData() {
      try {
        const [groupsRes, postsRes] = await Promise.all([
          axios.get("/api/groups/joined"),
          axios.get("/api/groups/posts"),
        ]);
        if (mounted) {
          if (Array.isArray(groupsRes.data)) setMyGroups(groupsRes.data);
          if (Array.isArray(postsRes.data)) setPosts(postsRes.data);
        }
      } catch (err) {
        // ignore, keep mock-data as fallback
      }
    }
    fetchGroupsData();
    return () => (mounted = false);
  }, []);

  function handleGroupCreated(newGroup) {
    setMyGroups((prev) => [newGroup, ...prev]);
  }

  async function handleJoinGroup(groupId) {
    try {
      await axios.post(`/api/groups/${groupId}/join`);
      const groupToJoin = suggested.find((g) => g.id === groupId);
      if (groupToJoin) {
        setMyGroups((prev) => [groupToJoin, ...prev]);
        setSuggested((prev) => prev.filter((g) => g.id !== groupId));
      }
    } catch (err) {
      console.error("Failed to join group:", err);
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
              + Create Group
            </button>
          </section>

          <div className="group-container">
            {/* Cột trái: Các group đã tham gia + Bài viết */}
            <div className="group-left">
              {/* Các group đã tham gia */}
              <section className="my-groups">
                <h2>My Groups ({myGroups.length})</h2>
                <div className="groups-list">
                  {myGroups.map((group) => (
                    <div key={group.id} className="group-item">
                      <img
                        src={group.image}
                        alt={group.name}
                        className="group-item-img"
                      />
                      <div className="group-item-info">
                        <h3>{group.name}</h3>
                        <p>{group.description}</p>
                        <span className="group-members">
                          {group.members} members
                        </span>
                      </div>
                    </div>
                  ))}
                  {myGroups.length === 0 && (
                    <p className="empty-state">
                      You haven't joined any groups yet.
                    </p>
                  )}
                </div>
              </section>

              {/* Bài viết từ các group đã tham gia */}
              <section className="group-posts">
                <h2>Posts from Your Groups</h2>
                <div className="posts-list">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                  {posts.length === 0 && (
                    <p className="empty-state">
                      No posts yet from your groups.
                    </p>
                  )}
                </div>
              </section>
            </div>

            {/* Cột phải: Gợi ý các group */}
            <aside className="group-right">
              <section className="suggested-groups">
                <h2>Suggested Groups</h2>
                <div className="suggested-list">
                  {suggested.map((group) => (
                    <div key={group.id} className="suggested-item">
                      <img
                        src={group.image}
                        alt={group.name}
                        className="suggested-img"
                      />
                      <div className="suggested-info">
                        <h4>{group.name}</h4>
                        <p className="suggested-desc">{group.description}</p>
                        <span className="suggested-members">
                          {group.members} members
                        </span>
                        <button
                          className="btn-join"
                          onClick={() => handleJoinGroup(group.id)}
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                  {suggested.length === 0 && (
                    <p className="empty-state">No more groups to suggest.</p>
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
