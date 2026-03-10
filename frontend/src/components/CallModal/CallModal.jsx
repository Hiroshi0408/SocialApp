import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./CallModal.css";

function CallModal({
  callState,
  incomingCall,
  onAcceptCall,
  onRejectCall,
  onEndCall,
  conversation,
}) {
  const { t } = useTranslation();
  const [callDuration, setCallDuration] = React.useState(0);

  useEffect(() => {
    let interval;
    if (callState === "active") {
      setCallDuration(0); // Reset timer when call becomes active
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      clearInterval(interval);
    };
  }, [callState]);

  if (callState === "idle" || callState === "ended") {
    return null;
  }

  const getTitle = () => {
    switch (callState) {
      case "incoming":
        return t("call.incoming_call");
      case "outgoing":
        return t("call.calling");
      case "active":
        return t("call.call_in_progress");
      default:
        return "";
    }
  };

  const formatDuration = (duration) => {
    const minutes = Math.floor(duration / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (duration % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const callDurationFormatted = formatDuration(callDuration);

  const username =
    callState === "incoming"
      ? incomingCall?.callerUsername
      : conversation?.participant?.username;

  return (
    <div className="call-modal-backdrop">
      <div className="call-modal">
        <div className="call-modal-header">
          <h2>{getTitle()}</h2>
        </div>
        <div className="call-modal-body">
          <p className="call-username">{username || "Unknown User"}</p>
          {callState === "active" && (
            <p className="call-duration">{callDurationFormatted}</p>
          )}
        </div>
        <div className="call-modal-footer">
          {callState === "incoming" && (
            <>
              <button
                className="call-btn call-accept-btn"
                onClick={onAcceptCall}
              >
                {t("call.accept")}
              </button>
              <button
                className="call-btn call-reject-btn"
                onClick={onRejectCall}
              >
                {t("call.reject")}
              </button>
            </>
          )}
          {(callState === "outgoing" || callState === "active") && (
            <button className="call-btn call-end-btn" onClick={onEndCall}>
              {t("call.end_call")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CallModal;
