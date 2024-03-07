// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract FundingBase is Initializable, PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    bytes32 public constant FUNDS_ADMIN_ROLE = keccak256("FUNDS_ADMIN_ROLE");

    // Maps a token address to a funder's address to their balance of that token.
    mapping(address => mapping(address => uint256)) private _tokenFunderBalances;

    error Unauthorized();
    error InsufficientBalance();
    error InvalidTokenAddress();
    error TransferFailed();

    function initialize(address defaultAdmin, address pauser, address upgrader) public initializer {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(UPGRADER_ROLE, upgrader);

        // Automatically granting the default admin FUNDS_ADMIN_ROLE might raise security considerations.
        _grantRole(FUNDS_ADMIN_ROLE, defaultAdmin);
    }

    // Allows the contract to receive native currency deposits.
    receive() external payable {
        _tokenFunderBalances[address(0)][_msgSender()] += msg.value;
    }

    // Allows users to deposit ERC-20 tokens into the contract.
    function fundToken(address token, uint256 amount) public whenNotPaused {
        // Very important:
        if (token == address(0)) revert InvalidTokenAddress();

        IERC20(token).transferFrom(_msgSender(), address(this), amount);
        _tokenFunderBalances[token][_msgSender()] += amount;
    }

    // Withdraw native currency from the contract.
    function withdrawEther(uint256 amount) public {
        _requireCanHandle(_msgSender(), _msgSender(), address(0), amount);
        _tokenFunderBalances[address(0)][_msgSender()] -= amount;
        (bool sent,) = _msgSender().call{value: amount}("");
        if (!sent) revert TransferFailed();
    }

    // Withdraw ERC-20 tokens from the contract.
    function withdrawToken(address token, uint256 amount) public {
        _requireCanHandle(_msgSender(), _msgSender(), token, amount);
        _tokenFunderBalances[token][_msgSender()] -= amount;
        if (!IERC20(token).transfer(_msgSender(), amount)) revert TransferFailed();
    }

    // Facilitates the transfer of tokens (native or ERC-20) from one user to another within the contract.
    function transferFrom(address from, address to, address token, uint256 amount) public {
        _requireCanHandle(_msgSender(), from, token, amount);
        _tokenFunderBalances[token][from] -= amount;
        _tokenFunderBalances[token][to] += amount;
    }

    // Ensures the operation can proceed based on the operator's role and balance, throwing errors if not.
    function _requireCanHandle(address operator, address from, address token, uint256 amount) private view {
        bool hasSufficientBalance = (_tokenFunderBalances[token][from] >= amount);
        if (!hasSufficientBalance) revert InsufficientBalance();

        bool isOperatorTheOwner = (from == operator);
        bool isFundsAdmin = hasRole(FUNDS_ADMIN_ROLE, operator);

        if (!(isOperatorTheOwner || isFundsAdmin)) {
            revert Unauthorized();
        }
    }

    // Retrieves the balance of a funder for a specific token.
    function balanceOf(address funder, address token) public view returns (uint256) {
        return _tokenFunderBalances[token][funder];
    }

    // Ensures that only an account with DEFAULT_ADMIN_ROLE can authorize contract upgrades.
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
