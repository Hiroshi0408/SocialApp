/**
 * Encryption Service sử dụng Web Crypto API (built-in browser)
 * KHÔNG CẦN cài thêm package nào
 * Sử dụng AES-GCM 256-bit
 */

class EncryptionService {
  constructor() {
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
  }

  /**
   * Generate encryption key từ conversationId và 2 userId
   * Key này sẽ giống nhau cho cả 2 user trong conversation
   */
  async generateConversationKey(conversationId, userId1, userId2) {
    try {
      // Sort userId để đảm bảo key giống nhau cho cả 2 users
      const sortedUsers = [userId1, userId2].sort();
      const keyMaterial = `${conversationId}-${sortedUsers[0]}-${sortedUsers[1]}`;

      // Hash keyMaterial với SHA-256
      const keyData = this.encoder.encode(keyMaterial);
      const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);

      // Import hash làm AES key
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        hashBuffer,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );

      return cryptoKey;
    } catch (error) {
      console.error("Key generation error:", error);
      throw new Error("Failed to generate encryption key");
    }
  }

  /**
   * Mã hóa tin nhắn
   */
  async encryptMessage(message, cryptoKey) {
    try {
      if (!message || typeof message !== "string") {
        throw new Error("Invalid message");
      }

      if (!cryptoKey) {
        throw new Error("Encryption key is required");
      }

      // Generate random IV (Initialization Vector)
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt
      const messageData = this.encoder.encode(message);
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        messageData,
      );

      // Combine IV + encrypted data
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);

      // Convert to base64
      return this.arrayBufferToBase64(combined);
    } catch (error) {
      console.error("Encryption error:", error);
      throw new Error("Failed to encrypt message");
    }
  }

  /**
   * Giải mã tin nhắn
   */
  async decryptMessage(encryptedMessage, cryptoKey) {
    try {
      if (!encryptedMessage) {
        throw new Error("Invalid encrypted message");
      }

      if (!cryptoKey) {
        throw new Error("Decryption key is required");
      }

      // Convert from base64
      const combined = this.base64ToArrayBuffer(encryptedMessage);

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);

      // Decrypt
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        encryptedData,
      );

      // Convert to string
      return this.decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error("Decryption error:", error);
      return "[Encrypted message - Unable to decrypt]";
    }
  }

  /**
   * Mã hóa file/image (base64)
   */
  async encryptFile(fileBase64, cryptoKey) {
    try {
      return await this.encryptMessage(fileBase64, cryptoKey);
    } catch (error) {
      console.error("File encryption error:", error);
      throw new Error("Failed to encrypt file");
    }
  }

  /**
   * Giải mã file/image
   */
  async decryptFile(encryptedFileBase64, cryptoKey) {
    try {
      return await this.decryptMessage(encryptedFileBase64, cryptoKey);
    } catch (error) {
      console.error("File decryption error:", error);
      return null;
    }
  }

  /**
   * Verify xem tin nhắn có được mã hóa không
   */
  isEncrypted(message) {
    // Check if it's valid base64
    try {
      return (
        message &&
        typeof message === "string" &&
        /^[A-Za-z0-9+/=]+$/.test(message)
      );
    } catch {
      return false;
    }
  }

  /**
   * Helper: ArrayBuffer to Base64
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Helper: Base64 to ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Generate random key (for testing)
   */
  async generateRandomKey() {
    return await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
  }
}

// Export singleton instance
const encryptionService = new EncryptionService();
export default encryptionService;
