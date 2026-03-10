import { useState, useCallback } from "react";

export const useAvatarError = () => {
  const [avatarErrors, setAvatarErrors] = useState({});

  const handleAvatarError = useCallback((userId) => {
    setAvatarErrors((prev) => ({ ...prev, [userId]: true }));
  }, []);

  const getAvatarSrc = useCallback(
    (user, getUserAvatar) => {
      if (!user) return "/images/default-avatar.png";
      if (avatarErrors[user._id]) {
        return "/images/default-avatar.png";
      }
      return getUserAvatar(user);
    },
    [avatarErrors],
  );

  const resetAvatarError = useCallback((userId) => {
    setAvatarErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[userId];
      return newErrors;
    });
  }, []);

  return {
    avatarErrors,
    handleAvatarError,
    getAvatarSrc,
    resetAvatarError,
  };
};
