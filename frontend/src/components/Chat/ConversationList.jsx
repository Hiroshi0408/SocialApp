import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getUserAvatar, formatTimestamp } from "../../utils";
import { useSocket } from "../../contexts/SocketContext";
import { useAuth } from "../../contexts/AuthContext";
import encryptionService from "../../utils/encryptionService";
import "./ConversationList.css";

// Decryption sub-component for the last message
function LastMessage({ conversation }) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [decryptedContent, setDecryptedContent] = useState(
    conversation.lastMessage?.content || "",
  );

  useEffect(() => {
    const decryptLastMessage = async () => {
      const lastMessage = conversation.lastMessage;

      if (!lastMessage || !lastMessage.content) {
        setDecryptedContent(t("messagesPage.noMessagesYet"));
        return;
      }

      if (lastMessage.isEncrypted) {
        try {
          const key = await encryptionService.generateConversationKey(
            conversation._id,
            currentUser._id,
            conversation.participant._id,
          );
          const decrypted = await encryptionService.decryptMessage(
            lastMessage.content,
            key,
          );
          // Check for decryption failure message
          if (decrypted.startsWith("[Encrypted")) {
            setDecryptedContent("🔒 " + t("messagesPage.encryptedMessage"));
          } else {
            setDecryptedContent(decrypted);
          }
        } catch (error) {
          console.error("Failed to decrypt last message:", error);
          setDecryptedContent("🔒 " + t("messagesPage.encryptedMessage"));
        }
      } else {
        setDecryptedContent(lastMessage.content);
      }
    };

    if (currentUser?._id && conversation?.participant?._id) {
      decryptLastMessage();
    }
  }, [conversation, currentUser, t]);

  return <>{decryptedContent}</>;
}

function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  loading,
}) {
  const { t } = useTranslation();
  const { onlineUsers } = useSocket();

  if (loading) {
    return (
      <div className="conversation-list">
        <div className="conversation-list-header">
          <h2>{t("messagesPage.messagesListTitle")}</h2>
        </div>
        <div className="conversation-list-body">
          <div className="conversation-list-loading">
            {t("messagesPage.loadingConversations")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>{t("messagesPage.messagesListTitle")}</h2>
      </div>

      <div className="conversation-list-body">
        {conversations.length === 0 ? (
          <div className="conversation-list-empty">
            <p>{t("messagesPage.noConversations")}</p>
            <span>{t("messagesPage.startConversationPrompt")}</span>
          </div>
        ) : (
          conversations.map((conversation) => {
            const isOnline = onlineUsers.includes(
              conversation.participant?._id,
            );
            return (
              <button
                key={conversation._id}
                className={`conversation-item ${
                  selectedConversation?._id === conversation._id ? "active" : ""
                }`}
                onClick={() => onSelectConversation(conversation)}
              >
                <div className="conversation-avatar-container">
                  <img
                    src={getUserAvatar(conversation.participant)}
                    alt={conversation.participant.username}
                    className="conversation-avatar"
                  />
                  <div
                    className={`conversation-status-dot ${
                      isOnline ? "online" : "offline"
                    }`}
                  ></div>
                </div>
                <div className="conversation-info">
                  <div className="conversation-top">
                    <span className="conversation-username">
                      {conversation.participant.username}
                    </span>
                    {conversation.lastMessageAt && (
                      <span className="conversation-time">
                        {formatTimestamp(conversation.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <div className="conversation-bottom">
                    <span
                      className={`conversation-last-message ${
                        conversation.unreadCount > 0 ? "unread" : ""
                      }`}
                    >
                      <LastMessage conversation={conversation} />
                    </span>
                    {conversation.unreadCount > 0 && (
                      <span className="conversation-unread-badge">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ConversationList;
