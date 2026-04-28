// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../Charity.sol";

/**
 * @title ReentrancyAttacker
 * @notice Mock attacker dùng trong test để chứng minh ReentrancyGuard hoạt động.
 *
 * Flow tấn công:
 *  1) attacker.donate{value: x}(id) — attacker trở thành donor.
 *  2) Sau khi campaign FAILED, attacker.attack(id) gọi charity.claimRefund.
 *  3) Trong quá trình charity transfer ETH về attacker, receive() kích hoạt và
 *     thử gọi charity.claimRefund lần 2 (reentrant).
 *  4) ReentrancyGuard phải revert lần gọi thứ 2 — ta bọc try/catch để outer
 *     tx vẫn hoàn tất và test assertable được.
 */
contract ReentrancyAttacker {
    Charity public charity;
    uint256 public campaignId;
    bool public reentered;
    bool public reentryReverted;

    constructor(address _charity) {
        charity = Charity(_charity);
    }

    function donate(uint256 id) external payable {
        campaignId = id;
        charity.donate{value: msg.value}(id);
    }

    function attack(uint256 id) external {
        campaignId = id;
        reentered = false;
        reentryReverted = false;
        charity.claimRefund(id);
    }

    // Nhận ETH từ claimRefund → thử reentry vào claimRefund lần nữa.
    // Dùng try/catch để không bubble up revert, outer tx vẫn hoàn tất → ta
    // quan sát được reentryReverted và balance thật của attacker.
    receive() external payable {
        if (!reentered) {
            reentered = true;
            try charity.claimRefund(campaignId) {
                // Nếu vào được đây là guard bị thủng.
                reentryReverted = false;
            } catch {
                reentryReverted = true;
            }
        }
    }
}
