// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title Charity
 * @notice Contract gây quỹ theo pattern threshold + milestone.
 *
 * State machine (happy path): OPEN -> FUNDED -> EXECUTING -> COMPLETED
 * State machine (sad path):   OPEN -> FAILED -> (donor claim refund riêng)
 *
 * Vai trò:
 *  - DEFAULT_ADMIN_ROLE: whitelist/unwhitelist org, force-fail khi dispute.
 *  - CAMPAIGN_CREATOR_ROLE: org đã verified off-chain + được admin whitelist on-chain.
 *  - OPERATOR_ROLE: ví BE, gọi markExecuting + unlockMilestone khi admin duyệt
 *    report off-chain (post báo cáo). Không có quyền rút tiền.
 *
 * Các decision đã chốt (xem notes/11-charity-donation-plan.md):
 *  - Milestone cứng: sum(milestoneAmounts) == goal, không đổi sau khi tạo.
 *  - Pull refund: donor tự claim, không loop push — chống reentrancy + out-of-gas.
 *  - ETH native: donate bằng msg.value, không ERC-20.
 *  - Off-chain metadata: chỉ commit bytes32 metadataHash lên-chain, nội dung lưu Mongo.
 */
contract Charity is AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant CAMPAIGN_CREATOR_ROLE = keccak256("CAMPAIGN_CREATOR_ROLE");

    uint256 public constant MIN_MILESTONES = 2;
    uint256 public constant MAX_MILESTONES = 10;
    // Phần trăm tối đa cho 1 milestone — ép campaign chia ít nhất 2 mốc thực sự,
    // chống case 1 mốc gom 100% goal (scam pattern). 50% = MAX_MILESTONE_PERCENT.
    uint256 public constant MAX_MILESTONE_PERCENT = 50;

    enum Status {
        OPEN,
        FUNDED,
        EXECUTING,
        COMPLETED,
        FAILED,
        REFUNDED
    }

    struct Milestone {
        uint256 amount;
        bool unlocked;
    }

    struct Campaign {
        address beneficiary;
        uint256 goal;
        uint256 raised;
        uint256 deadline;
        uint256 unlockedTotal;
        Status status;
        bytes32 metadataHash;
        bool exists;
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Milestone[]) private _milestones;
    // campaignId => donor => tổng wei đã donate (dùng cho claimRefund pull pattern)
    mapping(uint256 => mapping(address => uint256)) public contributions;

    uint256 public nextCampaignId;

    event CampaignCreated(
        uint256 indexed id,
        address indexed beneficiary,
        uint256 goal,
        uint256 deadline,
        bytes32 metadataHash
    );
    event Donated(
        uint256 indexed id,
        address indexed donor,
        uint256 amount,
        uint256 newRaised
    );
    event StatusChanged(uint256 indexed id, Status from, Status to);
    event MilestoneUnlocked(uint256 indexed id, uint256 indexed idx, uint256 amount);
    event RefundClaimed(uint256 indexed id, address indexed donor, uint256 amount);

    constructor(address admin, address operator) {
        require(admin != address(0) && operator != address(0), "Zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
    }

    // ═══════════════════════ Admin ═══════════════════════

    function whitelistOrg(address org) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(org != address(0), "Zero address");
        _grantRole(CAMPAIGN_CREATOR_ROLE, org);
    }

    function unwhitelistOrg(address org) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(CAMPAIGN_CREATOR_ROLE, org);
    }

    // ═══════════════════════ Org ═══════════════════════

    /**
     * @notice Tạo campaign mới. Caller tự động là beneficiary (ví org).
     * @param goal mục tiêu gây quỹ (wei).
     * @param durationSec thời gian gây quỹ tính từ block hiện tại.
     * @param milestoneAmounts mảng số tiền mỗi milestone (wei). Sum phải == goal.
     * @param metadataHash hash off-chain metadata (title, description, ...) để commit chống sửa lén.
     */
    function createCampaign(
        uint256 goal,
        uint256 durationSec,
        uint256[] calldata milestoneAmounts,
        bytes32 metadataHash
    ) external onlyRole(CAMPAIGN_CREATOR_ROLE) returns (uint256) {
        require(goal > 0, "Goal must be > 0");
        require(durationSec > 0, "Duration must be > 0");
        require(
            milestoneAmounts.length >= MIN_MILESTONES &&
                milestoneAmounts.length <= MAX_MILESTONES,
            "Invalid milestone count"
        );

        uint256 sum;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            require(milestoneAmounts[i] > 0, "Zero milestone amount");
            // Per-milestone max %: rearrange amount/goal <= MAX/100 → amount*100 <= goal*MAX
            // tránh phép chia mất chính xác (Solidity integer math)
            require(
                milestoneAmounts[i] * 100 <= goal * MAX_MILESTONE_PERCENT,
                "Milestone exceeds max percent"
            );
            sum += milestoneAmounts[i];
        }
        require(sum == goal, "Sum(milestones) != goal");

        uint256 id = nextCampaignId++;
        uint256 deadline = block.timestamp + durationSec;

        campaigns[id] = Campaign({
            beneficiary: msg.sender,
            goal: goal,
            raised: 0,
            deadline: deadline,
            unlockedTotal: 0,
            status: Status.OPEN,
            metadataHash: metadataHash,
            exists: true
        });

        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            _milestones[id].push(Milestone({ amount: milestoneAmounts[i], unlocked: false }));
        }

        emit CampaignCreated(id, msg.sender, goal, deadline, metadataHash);
        return id;
    }

    // ═══════════════════════ Public (donor) ═══════════════════════

    /**
     * @notice Donate ETH vào campaign. Tự transition OPEN -> FUNDED khi raised đạt goal.
     *         nonReentrant để an toàn dù hiện tại chưa có external call,
     *         để lỡ sau có thêm hook thì không phải thêm lại.
     */
    function donate(uint256 id) external payable nonReentrant {
        Campaign storage c = campaigns[id];
        require(c.exists, "Campaign not found");
        require(c.status == Status.OPEN, "Not open");
        require(block.timestamp < c.deadline, "Deadline passed");
        require(msg.value > 0, "Zero value");

        c.raised += msg.value;
        contributions[id][msg.sender] += msg.value;

        if (c.raised >= c.goal) {
            c.status = Status.FUNDED;
            emit StatusChanged(id, Status.OPEN, Status.FUNDED);
        }

        emit Donated(id, msg.sender, msg.value, c.raised);
    }

    /**
     * @notice Public — ai cũng gọi được sau deadline để move campaign sang FAILED.
     *         Không đòi role vì đây là "cron crankable" — donor tự trigger để claim refund.
     */
    function markFailed(uint256 id) external {
        Campaign storage c = campaigns[id];
        require(c.exists, "Campaign not found");
        require(c.status == Status.OPEN, "Not open");
        require(block.timestamp >= c.deadline, "Deadline not reached");
        require(c.raised < c.goal, "Goal was met");

        c.status = Status.FAILED;
        emit StatusChanged(id, Status.OPEN, Status.FAILED);
    }

    /**
     * @notice Pull refund. CEI pattern — set contributions = 0 trước khi .call.
     *         Không dùng push loop vì nhiều donor sẽ vượt gas limit + 1 donor revert kéo cả tx fail.
     */
    function claimRefund(uint256 id) external nonReentrant {
        Campaign storage c = campaigns[id];
        require(c.exists, "Campaign not found");
        require(c.status == Status.FAILED, "Not refundable");

        uint256 amount = contributions[id][msg.sender];
        require(amount > 0, "Nothing to refund");

        contributions[id][msg.sender] = 0;

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Refund transfer failed");

        emit RefundClaimed(id, msg.sender, amount);
    }

    // ═══════════════════════ Operator (BE) ═══════════════════════

    function markExecuting(uint256 id) external onlyRole(OPERATOR_ROLE) {
        Campaign storage c = campaigns[id];
        require(c.exists, "Campaign not found");
        require(c.status == Status.FUNDED, "Not funded");

        c.status = Status.EXECUTING;
        emit StatusChanged(id, Status.FUNDED, Status.EXECUTING);
    }

    /**
     * @notice Giải ngân 1 milestone cho beneficiary. Operator (BE) gọi sau khi admin
     *         approve post báo cáo off-chain. CEI: flip unlocked + cộng total trước, .call sau.
     */
    function unlockMilestone(uint256 id, uint256 idx)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        Campaign storage c = campaigns[id];
        require(c.exists, "Campaign not found");
        require(c.status == Status.EXECUTING, "Not executing");
        require(idx < _milestones[id].length, "Bad milestone index");

        Milestone storage m = _milestones[id][idx];
        require(!m.unlocked, "Already unlocked");

        m.unlocked = true;
        c.unlockedTotal += m.amount;

        bool isLast = c.unlockedTotal >= c.goal;
        if (isLast) {
            c.status = Status.COMPLETED;
            emit StatusChanged(id, Status.EXECUTING, Status.COMPLETED);
        }

        (bool ok, ) = c.beneficiary.call{value: m.amount}("");
        require(ok, "Milestone transfer failed");

        emit MilestoneUnlocked(id, idx, m.amount);
    }

    // ═══════════════════════ Admin force ═══════════════════════

    /**
     * @notice Admin chuyển campaign FUNDED/EXECUTING → FAILED khi phát hiện gian lận.
     *         Sau đó donor có thể tự gọi claimRefund nhận lại đủ contribution.
     *
     *         Cấm khi đã unlock milestone (unlockedTotal > 0): nếu cho phép sẽ phải
     *         phân bổ pro-rata phần còn lại cho donor (raised - unlockedTotal),
     *         làm contract phức tạp + risk số dư hụt khi donor cuối claim.
     *         Trade-off: admin phải force-fail SỚM trước khi giải ngân lần đầu.
     */
    function adminForceFail(uint256 id) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Campaign storage c = campaigns[id];
        require(c.exists, "Campaign not found");
        require(
            c.status == Status.FUNDED || c.status == Status.EXECUTING,
            "Cannot force-fail in current status"
        );
        require(c.unlockedTotal == 0, "Already disbursed milestone");

        Status from = c.status;
        c.status = Status.FAILED;
        emit StatusChanged(id, from, Status.FAILED);
    }

    // ═══════════════════════ View ═══════════════════════

    function getMilestones(uint256 id) external view returns (Milestone[] memory) {
        return _milestones[id];
    }

    function milestoneCount(uint256 id) external view returns (uint256) {
        return _milestones[id].length;
    }
}
