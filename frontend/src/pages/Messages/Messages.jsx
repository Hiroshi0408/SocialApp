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
  const [conversations, setConversations] = useState([]);
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
        setConversations(response.conversations);
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

      setConversations((prevConversations) => {
        const existingIndex = prevConversations.findIndex(
          (c) => c._id === conversationId,
        );

        if (existingIndex !== -1) {
          const updated = [...prevConversations];
          const conv = { ...updated[existingIndex] };
          conv.lastMessage = message;
          conv.lastMessageAt = message.createdAt;
          conv.unreadCount = (conv.unreadCount || 0) + 1;
          updated.splice(existingIndex, 1);
          return [conv, ...updated];
        }

        fetchConversations();
        return prevConversations;
      });
    };

    socket.on("message:new", handleIncomingMessage);

    return () => {
      socket.off("message:new", handleIncomingMessage);
    };
  }, [socket, selectedConversation, fetchConversations]);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    if (conversation.unreadCount > 0) {
      setConversations((prevConversations) =>
        prevConversations.map((conv) =>
          conv._id === conversation._id
            ? { ...conv, unreadCount: 0 }
            : conv,
        ),
      );
    }
  };

  const handleNewMessage = (updatedConversation) => {
    setConversations((prevConversations) => {
      const filtered = prevConversations.filter(
        (c) => c._id !== updatedConversation._id,
      );
      return [updatedConversation, ...filtered];
    });
  };

  const handleMarkAsRead = (conversationId) => {
    setConversations((prevConversations) =>
      prevConversations.map((conv) =>
        conv._id === conversationId
          ? { ...conv, unreadCount: 0 }
          : conv,
      ),
    );
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
      {localStream && (
        <audio ref={localAudioRef} autoPlay muted playsInline />
      )}
      {remoteStream && (
        <audio ref={remoteAudioRef} autoPlay playsInline />
      )}
      <Sidebar />
      <div className="messages-content-wrapper">
        <Header />
        <main className="messages-main">
          <div className="messages-container">
            <ConversationList
              conversations={conversations}
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
