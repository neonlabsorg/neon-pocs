// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CheckIn {
    event CheckedIn(address indexed user, uint256 timestamp);

    mapping(address => uint256[]) public checkIns;

    /**
     * @notice Allows a user to check in.
     */
    function checkIn() external {
        uint256 timestamp = block.timestamp;
        checkIns[msg.sender].push(timestamp);
        emit CheckedIn(msg.sender, timestamp);
    }

    /**
     * @notice Returns the total check-in count for a user.
     * @param user The address of the user.
     * @return count The total number of check-ins for the user.
     */
    function getTotalCheckIns(
        address user
    ) external view returns (uint256 count) {
        require(user != address(0), "WALLET_INVALID");
        return checkIns[user].length;
    }
}