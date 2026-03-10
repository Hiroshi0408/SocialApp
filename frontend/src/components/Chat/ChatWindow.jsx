import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSocket } from "../../contexts/SocketContext";
import { useAuth } from "../../contexts/AuthContext";
import { chatService } from "../../api";
import { getUserAvatar, formatTimestamp, showError } from "../../utils";
import encryptionService from "../../utils/encryptionService"; // Import encryption service
import MessageInput from "./MessageInput";
import "./ChatWindow.css";

function ChatWindow({
  conversation,
  onNewMessage,
  onMarkAsRead,
  onInitiateCall,
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationKey, setConversationKey] = useState(null); // Encryption key
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const { socket, isConnected } = useSocket();
  const { user: currentUser } = useAuth();

  const conversationId = conversation?._id;
  const recipientId = conversation?.participant?._id;

  // Generate encryption key khi conversation load
  useEffect(() => {
    const generateKey = async () => {
      if (conversationId && currentUser?._id && recipientId) {
        try {
          const key = await encryptionService.generateConversationKey(
            conversationId,
            currentUser._id,
            recipientId,
          );
          setConversationKey(key);
          console.log(
            "🔑 Encryption key generated for conversation:",
            conversationId,
          );
        } catch (error) {
          console.error("Failed to generate encryption key:", error);
        }
      }
    };

    generateKey();
  }, [conversationId, currentUser?._id, recipientId]);

  const handleInitiateCall = () => {
    if (recipientId && conversationId) {
      onInitiateCall(recipientId, conversationId);
    }
  };

  const markAsRead = async () => {
    if (!conversationId) return;
    try {
      await chatService.markAsRead(conversationId);
      if (onMarkAsRead) {
        onMarkAsRead(conversationId);
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  // Fetch và decrypt messages
  const fetchMessages = useCallback(async () => {
    if (!conversationId || !conversationKey) return;

    try {
      setLoading(true);
      const response = await chatService.getMessages(conversationId);

      if (response.success) {
        // Decrypt tất cả messages
        const decryptedMessages = await Promise.all(
          response.messages.map(async (msg) => {
            // Chỉ decrypt nếu message được đánh dấu là encrypted
            if (msg.isEncrypted) {
              try {
                const decryptedContent = msg.content
                  ? await encryptionService.decryptMessage(
                      msg.content,
                      conversationKey,
                    )
                  : null;

                const decryptedMediaUrl = msg.mediaUrl
                  ? await encryptionService.decryptFile(
                      msg.mediaUrl,
                      conversationKey,
                    )
                  : null;

                return {
                  ...msg,
                  content: decryptedContent,
                  mediaUrl: decryptedMediaUrl,
                };
              } catch (error) {
                console.error("Failed to decrypt message:", msg._id, error);
                return {
                  ...msg,
                  content: "[Unable to decrypt message]",
                };
              }
            }

            // Message không mã hóa - giữ nguyên
            return msg;
          }),
        );

        setMessages(decryptedMessages);
        console.log(
          `✅ Decrypted ${decryptedMessages.filter((m) => m.isEncrypted).length}/${decryptedMessages.length} messages`,
        );
        markAsRead();
      }
    } catch (error) {
      console.error("Fetch messages error:", error);
      showError(t("messagesPage.loadMessagesError"));
    } finally {
      setLoading(false);
    }
  }, [conversationId, conversationKey, markAsRead, t]);

  const joinConversation = useCallback(() => {
    if (socket && conversationId) {
      socket.emit("chat:join", conversationId);
    }
  }, [socket, conversationId]);

  // Handle new message từ socket (cần decrypt)
  const handleNewMessage = useCallback(
    async (data) => {
      if (data.conversationId === conversationId && conversationKey) {
        let decryptedMessage = data.message;

        // Decrypt message nếu cần
        if (data.message.isEncrypted) {
          try {
            const decryptedContent = data.message.content
              ? await encryptionService.decryptMessage(
                  data.message.content,
                  conversationKey,
                )
              : null;

            const decryptedMediaUrl = data.message.mediaUrl
              ? await encryptionService.decryptFile(
                  data.message.mediaUrl,
                  conversationKey,
                )
              : null;

            decryptedMessage = {
              ...data.message,
              content: decryptedContent,
              mediaUrl: decryptedMediaUrl,
            };

            console.log("📨 Received and decrypted new message");
          } catch (error) {
            console.error("Failed to decrypt incoming message:", error);
            decryptedMessage = {
              ...data.message,
              content: "[Unable to decrypt message]",
            };
          }
        }

        setMessages((prev) => [...prev, decryptedMessage]);
        markAsRead();

        if (onNewMessage && conversation) {
          onNewMessage({
            ...conversation,
            lastMessage: decryptedMessage,
            lastMessageAt: decryptedMessage.createdAt,
          });
        }
      }
    },
    [conversationId, conversationKey, conversation, onNewMessage, markAsRead],
  );

  const handleTyping = useCallback(
    (data) => {
      if (data.conversationId === conversationId && data.isTyping) {
        setIsTyping(true);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          typingTimeoutRef.current = null;
        }, 3000);
      }
    },
    [conversationId],
  );

  const handleMessagesRead = useCallback(() => {
    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        read: true,
        readAt: new Date().toISOString(),
      })),
    );
  }, []);

  useEffect(() => {
    if (conversationId) {
      joinConversation();
    }

    return () => {
      if (conversationId && socket) {
        socket.emit("chat:leave", conversationId);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [conversationId, socket, joinConversation]);

  // Fetch messages khi có conversationKey
  useEffect(() => {
    if (conversationId && conversationKey) {
      fetchMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, conversationKey]); // Chỉ chạy khi conversationId hoặc conversationKey thay đổi

  useEffect(() => {
    if (!socket) return;

    socket.on("chat:message", handleNewMessage);
    socket.on("chat:typing", handleTyping);
    socket.on("messages:read", handleMessagesRead);

    return () => {
      socket.off("chat:message", handleNewMessage);
      socket.off("chat:typing", handleTyping);
      socket.off("messages:read", handleMessagesRead);
    };
  }, [socket, handleNewMessage, handleTyping, handleMessagesRead]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send message - MÃ HÓA trước khi gửi
  const handleSendMessage = async (
    content,
    messageType = "text",
    mediaUrl = null,
  ) => {
    if (!socket || !isConnected) {
      showError(t("messagesPage.notConnectedError"));
      return;
    }

    if (!conversationKey) {
      showError("Encryption key not ready");
      return;
    }

    try {
      let encryptedContent = content;
      let encryptedMediaUrl = mediaUrl;

      // Mã hóa content
      if (content) {
        encryptedContent = await encryptionService.encryptMessage(
          content,
          conversationKey,
        );
        console.log("🔒 Message encrypted");
      }

      // Mã hóa mediaUrl nếu có
      if (mediaUrl) {
        encryptedMediaUrl = await encryptionService.encryptFile(
          mediaUrl,
          conversationKey,
        );
        console.log("🔒 Media encrypted");
      }

      // Emit encrypted message
      socket.emit("chat:message", {
        conversationId: conversation._id,
        content: encryptedContent,
        messageType,
        mediaUrl: encryptedMediaUrl,
        isEncrypted: true, // Flag để backend biết message này đã mã hóa
      });

      console.log("✅ Encrypted message sent");
    } catch (error) {
      console.error("Encryption error:", error);
      showError("Failed to encrypt message");
    }
  };

  const handleTypingStart = () => {
    if (socket && conversation) {
      socket.emit("chat:typing", {
        conversationId: conversation._id,
        isTyping: true,
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const groupMessagesByDate = (messages) => {
    const groups = {};
    messages.forEach((message) => {
      const date = new Date(message.createdAt).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  if (loading) {
    return (
      <div className="chat-window">
        <div className="chat-loading">{t("messagesPage.loadingMessages")}</div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <img
          src={getUserAvatar(conversation.participant)}
          alt={conversation.participant.username}
          className="chat-header-avatar"
        />
        <div className="chat-header-info">
          <h3>{conversation.participant.username}</h3>
          <span>{conversation.participant.fullName}</span>
        </div>
        <div className="chat-header-actions">
          {/* Encryption indicator */}
          {conversationKey && (
            <div className="encryption-badge" title="End-to-end encrypted">
              🔒
            </div>
          )}
          <button
            className="chat-header-action-btn"
            onClick={handleInitiateCall}
            aria-label="Start voice call"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {Object.entries(messageGroups).map(([date, msgs]) => (
          <div key={date}>
            <div className="chat-date-separator">
              <span>{date}</span>
            </div>
            {msgs.map((message) => (
              <div
                key={message._id}
                className={`chat-message ${
                  message.sender._id === currentUser._id ? "sent" : "received"
                }`}
              >
                {message.sender._id !== currentUser._id && (
                  <img
                    src={getUserAvatar(message.sender)}
                    alt={message.sender.username}
                    className="chat-message-avatar"
                  />
                )}
                <div className="chat-message-content">
                  <div
                    className={`chat-message-bubble ${
                      message.messageType === "image" ? "is-image" : ""
                    }`}
                  >
                    {message.messageType === "image" && message.mediaUrl ? (
                      <>
                        <img
                          src={message.mediaUrl}
                          alt={t("messagesPage.sentImageAlt")}
                          className="chat-message-image"
                        />
                        {message.content && <p>{message.content}</p>}
                      </>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                  <span className="chat-message-time">
                    {formatTimestamp(message.createdAt)}
                    {message.read && message.sender._id === currentUser._id && (
                      <span className="chat-message-read">
                        {" "}
                        • {t("messagesPage.seenStatus")}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
        {isTyping && (
          <div className="chat-typing-indicator">
            <span>
              {t("messagesPage.isTyping", {
                username: conversation.participant.username,
              })}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={handleTypingStart}
      />
    </div>
  );
}

export default ChatWindow;
