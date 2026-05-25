const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ContentRegistry", function () {
  async function deployContentRegistryFixture() {
    const [author, other] = await ethers.getSigners();

    const ContentRegistry = await ethers.getContractFactory("ContentRegistry");
    const registry = await ContentRegistry.deploy();
    await registry.waitForDeployment();

    return { registry, author, other };
  }

  function hashContent(payload) {
    return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)));
  }

  it("registerPost stores content hash, owner, timestamp and emits event", async function () {
    const { registry, author } = await loadFixture(deployContentRegistryFixture);
    const postId = "post-001";
    const contentHash = hashContent({
      version: "v1",
      authorId: "user-1",
      caption: "Hello blockchain",
    });

    await expect(registry.connect(author).registerPost(postId, contentHash))
      .to.emit(registry, "PostRegistered")
      .withArgs(postId, author.address, anyValue);

    const post = await registry.verifyPost(postId);
    expect(post.contentHash).to.equal(contentHash);
    expect(post.owner).to.equal(author.address);
    expect(post.timestamp).to.be.greaterThan(0n);
    expect(post.exists).to.equal(true);
  });

  it("tracks msg.sender as owner for each registered post", async function () {
    const { registry, author, other } = await loadFixture(deployContentRegistryFixture);

    await registry.connect(author).registerPost("author-post", hashContent({ caption: "A" }));
    await registry.connect(other).registerPost("other-post", hashContent({ caption: "B" }));

    const authorPost = await registry.verifyPost("author-post");
    const otherPost = await registry.verifyPost("other-post");

    expect(authorPost.owner).to.equal(author.address);
    expect(otherPost.owner).to.equal(other.address);
  });

  it("reverts when registering a duplicate postId", async function () {
    const { registry, author, other } = await loadFixture(deployContentRegistryFixture);
    const postId = "post-duplicate";

    await registry.connect(author).registerPost(postId, hashContent({ caption: "original" }));

    await expect(
      registry.connect(other).registerPost(postId, hashContent({ caption: "edited" }))
    ).to.be.revertedWith("Post ID already exists");
  });

  it("reverts when verifying a missing post", async function () {
    const { registry } = await loadFixture(deployContentRegistryFixture);

    await expect(registry.verifyPost("missing-post")).to.be.revertedWith("Post does not exist");
  });
});
