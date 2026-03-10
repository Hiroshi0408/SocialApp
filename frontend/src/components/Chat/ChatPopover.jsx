import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";
import { chatService } from "../../api";
import { useSocket } from "../../contexts/SocketContext";
import "./ChatPopover.css";

export default function ChatPopover({ open, onClose }) {
  const popRef = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const { socket } = useSocket();

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await chatService.getConversations();
      if (response?.success) {
        setConversations(response.conversations || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchConversations();
  }, [open, fetchConversations]);

  useEffect(() => {
    if (!open) return;

    const handleDown = (e) => {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (!socket) return;

    const handleIncomingMessage = (data) => {
      const { message, conversationId } = data || {};

      if (selectedConversation && selectedConversation._id === conversationId)
        return;

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === conversationId);
        if (idx !== -1) {
          const updated = [...prev];
          const conv = { ...updated[idx] };
          conv.lastMessage = message;
          conv.lastMessageAt = message?.createdAt;
          conv.unreadCount = (conv.unreadCount || 0) + 1;
          updated.splice(idx, 1);
          return [conv, ...updated];
        }

        fetchConversations();
        return prev;
      });
    };

    socket.on("message:new", handleIncomingMessage);
    return () => socket.off("message:new", handleIncomingMessage);
  }, [open, socket, selectedConversation, fetchConversations]);

  useEffect(() => {
    if (open) document.body.classList.add("no-scroll");
    else document.body.classList.remove("no-scroll");

    return () => document.body.classList.remove("no-scroll");
  }, [open]);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);

    if (conversation?.unreadCount > 0) {
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversation._id ? { ...c, unreadCount: 0 } : c
        )
      );
    }
  };

  const handleNewMessage = (updatedConversation) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c._id !== updatedConversation._id);
      return [updatedConversation, ...filtered];
    });
  };

  const handleMarkAsRead = (conversationId) => {
    setConversations((prev) =>
      prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c))
    );
  };

  const filteredConversations = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return conversations;

    return conversations.filter((conv) => {
      const candidates = [];

      if (Array.isArray(conv.participants)) {
        conv.participants.forEach((p) => {
          candidates.push(p?.username, p?.fullName, p?.email);
        });
      }
      candidates.push(
        conv.otherUser?.username,
        conv.otherUser?.fullName,
        conv.otherUser?.email
      );

      const hay = candidates.filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [conversations, q]);

  if (!open) return null;

  return (
    <div className="chat-popover" ref={popRef} role="dialog" aria-label="Chats">
      <div className="chat-popover__top">
        {selectedConversation ? (
          <>
            <button
              type="button"
              className="chat-popover__iconbtn"
              onClick={() => setSelectedConversation(null)}
              aria-label="Back"
              title="Back"
            >
              ←
            </button>
            <div className="chat-popover__title">Chat</div>
            <button
              type="button"
              className="chat-popover__iconbtn"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <div className="chat-popover__title">Chats</div>
            <button
              type="button"
              className="chat-popover__iconbtn"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </>
        )}
      </div>

      {!selectedConversation ? (
        <>
          <div className="chat-popover__search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search conversations..."
            />
          </div>

          <div className="chat-popover__body">
            <ConversationList
              conversations={filteredConversations}
              selectedConversation={selectedConversation}
              onSelectConversation={handleSelectConversation}
              loading={loading}
            />
          </div>
        </>
      ) : (
        <div className="chat-popover__body chat-popover__body--detail">
          <ChatWindow
            conversation={selectedConversation}
            onNewMessage={handleNewMessage}
            onMarkAsRead={handleMarkAsRead}
          />
        </div>
      )}
    </div>
  );
}