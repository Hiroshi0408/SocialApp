import React from "react";
import "./VerifiedBadge.css";

function VerifiedBadge({ verifiedAt, size = "md", title }) {
  const tooltip =
    title ||
    (verifiedAt
      ? `Verified by admin on ${new Date(verifiedAt).toLocaleDateString()}`
      : "Verified organization");

  return (
    <span
      className={`verified-badge verified-badge--${size}`}
      title={tooltip}
      aria-label={tooltip}
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2 9.2 4.6l-3.6.4-.4 3.6L2 12l2.6 2.8-.4 3.6 3.6.4L12 22l2.8-2.6 3.6-.4.4-3.6L22 12l-2.6-2.8.4-3.6-3.6-.4L12 2Zm-1.4 13.4-3-3 1.4-1.4 1.6 1.6 4.6-4.6 1.4 1.4-6 6Z" />
      </svg>
    </span>
  );
}

export default VerifiedBadge;
