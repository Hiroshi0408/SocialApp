
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ContentRegistry {
    // 1. Struct lưu thông tin bài viết
    struct Post {
        bytes32 contentHash;  // hash của bài viết
        address owner;        // ví của người đăng
        uint256 timestamp;    // thời điểm đăng ký
        bool exists;          // để check tồn tại
    }

    // 2. Mapping: postId → Post
    mapping(string => Post) private posts;

    // 3. Event — thông báo khi có bài mới được đăng ký
    event PostRegistered(string postId, address owner, uint256 timestamp);

    // 4. Function registerPost(string postId, bytes32 contentHash)
    function registerPost(string memory postId, bytes32 contentHash) public {
        require(!posts[postId].exists, "Post ID already exists");

        posts[postId] = Post({
            contentHash: contentHash,
            owner: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });

        emit PostRegistered(postId, msg.sender, block.timestamp);
    }

    // 5. Function verifyPost(string postId) → trả về Post
    function verifyPost(string memory postId) public view returns (Post memory) {
        require(posts[postId].exists, "Post does not exist");
        return posts[postId];
    }
}