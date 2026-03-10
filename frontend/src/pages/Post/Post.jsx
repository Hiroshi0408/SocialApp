import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import PostCard from "../../components/PostCard/PostCard";
import postService from "../../api/postService";
import { showError } from "../../utils";
import "./Post.css";

function Post() {
  const { t } = useTranslation();
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPost();
  }, [postId]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await postService.getPostById(postId);

      if (response.success) {
        setPost(response.post);
      } else {
        setError(t("post.notFoundError"));
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError(t("post.notFoundError"));
      } else {
        setError(t("post.loadError"));
        showError(t("post.loadError"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate("/home");
  };

  return (
    <div className="post-page">
      <Sidebar />
      <div className="post-content-wrapper">
        <Header />
        <main className="post-main">
          <div className="post-container">
            <div className="post-content">
              <div className="post-header-nav">
                <button onClick={handleGoBack} className="back-btn">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  {t("post.goBack")}
                </button>
              </div>

              {loading && (
                <div className="post-loading">
                  <div className="loading-spinner"></div>
                  <p>{t("post.loadingPost")}</p>
                </div>
              )}

              {error && (
                <div className="post-error">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <h3>{error}</h3>
                  <p>{t("post.postNotFoundMessage")}</p>
                  <button onClick={handleGoHome} className="home-btn">
                    {t("post.goToHome")}
                  </button>
                </div>
              )}

              {!loading && !error && post && <PostCard post={post} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Post;
