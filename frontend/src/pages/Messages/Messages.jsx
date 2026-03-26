import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import Sidebar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import ConversationList from "../../components/Chat/ConversationList";
import ChatWindow from "../../components/Chat/ChatWindow";
import { chatService } from "../../api";
import { useSocket } from "../../contexts/SocketContext";
import { useVoiceCall } from "../../hooks/useVoiceCall";
import { showError } from "../../utils/toast";
import "./Messages.css";

import CallModal from "../../components/CallModal/CallModal";

function Messages() {
  const { t } = useTranslation();
  const [friendConversations, setFriendConversations] = useState([]);
  const [pendingConversations, setPendingConversations] = useState([]);
  const [activeTab, setActiveTab] = useState("friends");
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const { socket, setUnreadMessages } = useSocket();

  const {
    callState,
    localStream,
    remoteStream,
    incomingCall,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
  } = useVoiceCall();

  const localAudioRef = useRef();
  const remoteAudioRef = useRef();

  useEffect(() => {
    if (localStream && localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    console.log("Call state changed:", callState);
  }, [callState]);

  useEffect(() => {
    if (setUnreadMessages) {
      setUnreadMessages(0);
    }
  }, [setUnreadMessages]);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await chatService.getConversations();
      if (response.success) {
        setFriendConversations(response.friendConversations || []);
        setPendingConversations(response.pendingConversations || []);
      }
    } catch (error) {
      showError(t("messagesPage.loadConversationsError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (data) => {
      const { message, conversationId } = data;

      if (selectedConversation && selectedConversation._id === conversationId) {
        return;
      }

      let foundConversation = false;

      setFriendConversations((prevConversations) => {
        const existingIndex = prevConversations.findIndex(
          (c) => c._id === conversationId,
        );

        if (existingIndex === -1) return prevConversations;

        foundConversation = true;
        const updated = [...prevConversations];
        const conv = { ...updated[existingIndex] };
        conv.lastMessage = message;
        conv.lastMessageAt = message.createdAt;
        conv.unreadCount = (conv.unreadCount || 0) + 1;
        updated.splice(existingIndex, 1);
        return [conv, ...updated];
      });

      setPendingConversations((prevConversations) => {
        const existingIndex = prevConversations.findIndex(
          (c) => c._id === conversationId,
        );

        if (existingIndex === -1) return prevConversations;

        foundConversation = true;
        const updated = [...prevConversations];
        const conv = { ...updated[existingIndex] };
        conv.lastMessage = message;
        conv.lastMessageAt = message.createdAt;
        conv.unreadCount = (conv.unreadCount || 0) + 1;
        updated.splice(existingIndex, 1);
        return [conv, ...updated];
      });

      if (!foundConversation) {
        fetchConversations();
      }
    };

    socket.on("message:new", handleIncomingMessage);

    return () => {
      socket.off("message:new", handleIncomingMessage);
    };
  }, [socket, selectedConversation, fetchConversations]);

  const visibleConversations =
    activeTab === "friends" ? friendConversations : pendingConversations;

  useEffect(() => {
    if (!selectedConversation) return;

    const isVisible = visibleConversations.some(
      (conversation) => conversation._id === selectedConversation._id,
    );

    if (!isVisible) {
      setSelectedConversation(null);
    }
  }, [activeTab, visibleConversations, selectedConversation]);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    if (conversation.unreadCount > 0) {
      const clearUnread = (prevConversations) =>
        prevConversations.map((conv) =>
          conv._id === conversation._id ? { ...conv, unreadCount: 0 } : conv,
        );

      setFriendConversations(clearUnread);
      setPendingConversations(clearUnread);
    }
  };

  const handleNewMessage = (updatedConversation) => {
    const updateConversationList = (prevConversations) => {
      const existingIndex = prevConversations.findIndex(
        (conversation) => conversation._id === updatedConversation._id,
      );

      if (existingIndex === -1) {
        return prevConversations;
      }

      const filtered = prevConversations.filter(
        (conversation) => conversation._id !== updatedConversation._id,
      );
      return [updatedConversation, ...filtered];
    };

    setFriendConversations(updateConversationList);
    setPendingConversations(updateConversationList);
  };

  const handleMarkAsRead = (conversationId) => {
    const markRead = (prevConversations) =>
      prevConversations.map((conv) =>
        conv._id === conversationId ? { ...conv, unreadCount: 0 } : conv,
      );

    setFriendConversations(markRead);
    setPendingConversations(markRead);
  };

  return (
    <div className="messages-page">
      <CallModal
        callState={callState}
        incomingCall={incomingCall}
        onAcceptCall={acceptCall}
        onRejectCall={rejectCall}
        onEndCall={endCall}
        conversation={selectedConversation}
      />
      {/* Audio elements for the call */}
      {localStream && <audio ref={localAudioRef} autoPlay muted playsInline />}
      {remoteStream && <audio ref={remoteAudioRef} autoPlay playsInline />}
      <Sidebar />
      <div className="messages-content-wrapper">
        <Header />
        <main className="messages-main">
          <div className="messages-container">
            <div className="messages-tabs">
              <button
                className={`messages-tab-btn ${
                  activeTab === "friends" ? "active" : ""
                }`}
                onClick={() => setActiveTab("friends")}
                type="button"
              >
                {t("messagesPage.friendsTab")}
              </button>
              <button
                className={`messages-tab-btn ${
                  activeTab === "pending" ? "active" : ""
                }`}
                onClick={() => setActiveTab("pending")}
                type="button"
              >
                {t("messagesPage.pendingTab")}
              </button>
            </div>
            <ConversationList
              conversations={visibleConversations}
              selectedConversation={selectedConversation}
              onSelectConversation={handleSelectConversation}
              loading={loading}
            />
            {selectedConversation ? (
              <ChatWindow
                conversation={selectedConversation}
                onNewMessage={handleNewMessage}
                onMarkAsRead={handleMarkAsRead}
                onInitiateCall={initiateCall}
              />
            ) : (
              <div className="messages-empty">
                <div className="messages-empty-icon">
                  <svg
                    width="96"
                    height="96"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h2>{t("messagesPage.yourMessagesTitle")}</h2>
                <p>{t("messagesPage.yourMessagesDescription")}</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Messages;
