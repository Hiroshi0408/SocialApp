import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import PostCard from "../PostCard/PostCard";
import { PostSkeleton } from "../Skeleton/Skeleton";
import postService from "../../api/postService";
import { normalizeArrayResponse, getId } from "../../utils";
import "./Feed.css";

function Feed() {
  const { t } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [feedType, setFeedType] = useState("friends");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef(null);

  const fetchPosts = useCallback(
    async (pageNum = 1, isLoadMore = false) => {
      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const data =
          feedType === "all"
            ? await postService.getAllPosts(pageNum)
            : await postService.getFeed(pageNum, undefined, feedType);

        const newPosts = normalizeArrayResponse(data, "posts");
        const hasMoreData = data.pagination?.hasMore ?? newPosts.length > 0;

        if (isLoadMore) {
          setPosts((prev) => [...prev, ...newPosts]);
        } else {
          setPosts(newPosts);
        }

        setHasMore(hasMoreData);
      } catch (err) {
        console.error("Failed to fetch posts:", err);
        setError(err.message);
      } finally {
        if (isLoadMore) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [feedType],
  );

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setPosts([]);
    fetchPosts(1, false);
  }, [feedType, fetchPosts]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(nextPage, true);
    }
  }, [page, loadingMore, hasMore, fetchPosts]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.5 },
    );
    const observedNode = observerTarget.current;

    if (observedNode) {
      observer.observe(observedNode);
    }

    return () => {
      if (observedNode) {
        observer.unobserve(observedNode);
      }
    };
  }, [loadMore, hasMore, loadingMore, loading]);

  const handleFeedTypeChange = (type) => {
    if (type !== feedType) {
      setFeedType(type);
    }
  };

  const handlePostDeleted = useCallback((postId) => {
    setPosts((prev) => prev.filter((p) => getId(p) !== postId));
  }, []);

  return (
    <div className="feed-container">
      <div className="feed-tabs">
        <button
          className={`feed-tab ${feedType === "friends" ? "active" : ""}`}
          onClick={() => handleFeedTypeChange("friends")}
        >
          {t("feed.friends")}
        </button>
        <button
          className={`feed-tab ${feedType === "following" ? "active" : ""}`}
          onClick={() => handleFeedTypeChange("following")}
        >
          {t("feed.following")}
        </button>
        <button
          className={`feed-tab ${feedType === "all" ? "active" : ""}`}
          onClick={() => handleFeedTypeChange("all")}
        >
          {t("feed.explore")}
        </button>
      </div>

      {loading ? (
        <>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </>
      ) : error ? (
        <div className="feed-error">
          <p>{t("feed.loadError", { error })}</p>
          <button onClick={() => fetchPosts(1, false)}>
            {t("feed.retry")}
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="feed-empty">
          <h3>{t("feed.noPosts")}</h3>
          <p>
            {feedType === "all"
              ? t("feed.noPostsAvailable")
              : feedType === "friends"
                ? t("feed.noFriendsPosts")
                : t("feed.noPostsAvailable")}
          </p>
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard
              key={getId(post)}
              post={post}
              onPostDeleted={handlePostDeleted}
            />
          ))}

          {hasMore && (
            <div ref={observerTarget} className="load-more-trigger">
              {loadingMore && <PostSkeleton />}
            </div>
          )}

          {!hasMore && posts.length > 0 && (
            <div className="feed-end">
              <p>{t("feed.endOfFeed")}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Feed;
