import { useState, useRef, useCallback, useEffect } from "react";
import { useSocket } from "../contexts/SocketContext";
import { showError, showSuccess } from "../utils/toast";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export const useVoiceCall = () => {
  const { socket } = useSocket();

  const [callState, setCallState] = useState("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCall, setIncomingCall] = useState(null);

  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const remoteStream = useRef(null);
  const callTimer = useRef(null);

  const currentCall = useRef({
    recipientId: null,
    conversationId: null,
  });

  const startCallTimer = useCallback(() => {
    setCallDuration(0);
    callTimer.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopCallTimer = useCallback(() => {
    if (callTimer.current) {
      clearInterval(callTimer.current);
      callTimer.current = null;
    }
    setCallDuration(0);
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current);
      });
    }

    pc.ontrack = (event) => {
      console.log("📥 Received remote track");
      remoteStream.current = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && currentCall.current.recipientId) {
        socket.emit("call:ice-candidate", {
          recipientId: currentCall.current.recipientId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallState("active");
        startCallTimer();
      } else if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        endCall();
      }
    };

    return pc;
  }, [socket, startCallTimer]);

  const getUserMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStream.current = stream;
      return stream;
    } catch (error) {
      console.error("Failed to get user media:", error);
      showError("Could not access microphone. Please check permissions.");
      throw error;
    }
  }, []);

  const initiateCall = useCallback(
    async (recipientId, conversationId) => {
      try {
        console.log("📞 Initiating call to:", recipientId);

        currentCall.current = { recipientId, conversationId };
        setCallState("outgoing");

        await getUserMedia();

        socket.emit("call:initiate", {
          recipientId,
          conversationId,
          isVideoCall: false,
        });
      } catch (error) {
        console.error("Failed to initiate call:", error);
        setCallState("idle");
        cleanupCall();
      }
    },
    [socket, getUserMedia],
  );

  const acceptCall = useCallback(async () => {
    try {
      console.log("✅ Accepting call from:", incomingCall.callerId);

      currentCall.current = {
        recipientId: incomingCall.callerId,
        conversationId: incomingCall.conversationId,
      };

      setCallState("active");
      setIncomingCall(null);

      await getUserMedia();

      peerConnection.current = createPeerConnection();

      socket.emit("call:accept", {
        callerId: incomingCall.callerId,
        conversationId: incomingCall.conversationId,
      });
    } catch (error) {
      console.error("Failed to accept call:", error);
      rejectCall();
    }
  }, [socket, incomingCall, getUserMedia, createPeerConnection]);

  const rejectCall = useCallback(() => {
    if (incomingCall) {
      console.log("❌ Rejecting call from:", incomingCall.callerId);

      socket.emit("call:reject", {
        callerId: incomingCall.callerId,
        conversationId: incomingCall.conversationId,
      });

      setIncomingCall(null);
      setCallState("idle");
    }
  }, [socket, incomingCall]);

  const endCall = useCallback(() => {
    console.log("📞 Ending call");

    if (currentCall.current.recipientId) {
      socket.emit("call:end", {
        recipientId: currentCall.current.recipientId,
        conversationId: currentCall.current.conversationId,
      });
    }

    setCallState("ended");
    setTimeout(() => {
      setCallState("idle");
    }, 2000);

    cleanupCall();
  }, [socket]);

  const cleanupCall = useCallback(() => {
    stopCallTimer();

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    remoteStream.current = null;
    currentCall.current = { recipientId: null, conversationId: null };
  }, [stopCallTimer]);

  const toggleMute = useCallback(() => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);

        socket.emit("call:toggle-mute", {
          recipientId: currentCall.current.recipientId,
          isMuted: !audioTrack.enabled,
        });
      }
    }
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    socket.on("call:incoming", (data) => {
      console.log("📞 Incoming call from:", data.callerUsername);
      console.log("call:incoming data", data);
      setIncomingCall(data);
      setCallState("incoming");
    });

    socket.on("call:ringing", () => {
      console.log("📞 Call is ringing...");
    });

    socket.on("call:accepted", async ({ recipientId }) => {
      console.log("✅ Call accepted by:", recipientId);

      peerConnection.current = createPeerConnection();
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      socket.emit("call:offer", { recipientId, offer });
    });

    socket.on("call:rejected", () => {
      console.log("❌ Call rejected");
      showError("Call was rejected");
      setCallState("idle");
      cleanupCall();
    });

    socket.on("call:offer", async ({ callerId, offer }) => {
      console.log("📥 Received offer from:", callerId);

      if (!peerConnection.current) {
        peerConnection.current = createPeerConnection();
      }

      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(offer),
      );
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      socket.emit("call:answer", { callerId, answer });
    });

    socket.on("call:answer", async ({ answer }) => {
      console.log("📥 Received answer");
      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(answer),
      );
    });

    socket.on("call:ice-candidate", async ({ candidate }) => {
      if (peerConnection.current && candidate) {
        await peerConnection.current.addIceCandidate(
          new RTCIceCandidate(candidate),
        );
      }
    });

    socket.on("call:ended", () => {
      console.log("📞 Call ended by peer");
      setCallState("ended");
      setTimeout(() => setCallState("idle"), 2000);
      cleanupCall();
    });

    socket.on("call:peer-muted", ({ isMuted }) => {
      console.log("🔇 Peer muted:", isMuted);
    });

    return () => {
      socket.off("call:incoming");
      socket.off("call:ringing");
      socket.off("call:accepted");
      socket.off("call:rejected");
      socket.off("call:offer");
      socket.off("call:answer");
      socket.off("call:ice-candidate");
      socket.off("call:ended");
      socket.off("call:peer-muted");
    };
  }, [socket, createPeerConnection, cleanupCall]);

  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, [cleanupCall]);

  return {
    callState,
    isMuted,
    callDuration,
    incomingCall,
    localStream: localStream.current,
    remoteStream: remoteStream.current,

    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
  };
};