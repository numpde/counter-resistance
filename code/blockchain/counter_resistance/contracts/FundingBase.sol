// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title A base contract for funding operations including deposit, withdraw, and transfer functionalities.
 * @dev Extends Initializable, PausableUpgradeable, AccessControlUpgradeable, and UUPSUpgradeable
 * from OpenZeppelin to provide role-based access control, pausability, and upgradability.
 */
contract FundingBase is Initializable, PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant FUNDS_ADMIN_ROLE = keccak256("FUNDS_ADMIN_ROLE");

    /* @dev Maps a token address to a funder's address to their balance of that token. */
    mapping(address => mapping(address => uint256)) private _tokenFunderBalances;

    error Unauthorized();
    error InsufficientBalance();
    error InvalidTokenAddress();
    error TransferFailed();
    error InsufficientTokenApproval();

    /**
     * @dev Initializes the contract by setting up roles and pausability.
     * @param defaultAdmin The address to receive all roles initially.
     * @param pauser The address that will be granted the pauser role.
     * @param upgrader The address that will be granted the upgrader role.
     */
    function initialize(address defaultAdmin, address pauser, address upgrader) public initializer {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(UPGRADER_ROLE, upgrader);

        /* Automatically granting the default admin FUNDS_ADMIN_ROLE. */
        _grantRole(FUNDS_ADMIN_ROLE, defaultAdmin);
    }

    /**
     * @dev Allows the contract to receive native currency deposits.
     */
    receive() external payable {
        _tokenFunderBalances[address(0)][_msgSender()] += msg.value;
    }

    /**
     * @dev Allows users to deposit ERC-20 tokens into the contract. Users must have already approved
     * the contract to spend at least `amount` tokens on their behalf by calling the `approve` method
     * on the ERC-20 token contract.
     * @param token The ERC-20 token address.
     * @param amount The amount of tokens to deposit.
     */
    function fundToken(address token, uint256 amount) public whenNotPaused {
        if (token == address(0)) revert InvalidTokenAddress();

        // Check if the contract is allowed to transfer the specified amount of tokens on behalf of the sender.
        uint256 currentAllowance = IERC20(token).allowance(_msgSender(), address(this));
        if (currentAllowance < amount) revert InsufficientTokenApproval();

        IERC20(token).transferFrom(_msgSender(), address(this), amount);
        _tokenFunderBalances[token][_msgSender()] += amount;
    }

    /**
     * @dev Withdraw native currency from the contract.
     * @param amount The amount of native currency to withdraw.
     */
    function withdrawEther(uint256 amount) public nonReentrant {
        _requireCanHandle(_msgSender(), _msgSender(), address(0), amount);
        _tokenFunderBalances[address(0)][_msgSender()] -= amount;
        (bool sent,) = _msgSender().call{value: amount}("");
        if (!sent) revert TransferFailed();
    }

    /**
     * @dev Withdraw ERC-20 tokens from the contract.
     * @param token The ERC-20 token address.
     * @param amount The amount of tokens to withdraw.
     */
    function withdrawToken(address token, uint256 amount) public nonReentrant {
        _requireCanHandle(_msgSender(), _msgSender(), token, amount);
        _tokenFunderBalances[token][_msgSender()] -= amount;
        if (!IERC20(token).transfer(_msgSender(), amount)) revert TransferFailed();
    }

    /**
     * @dev Facilitates the transfer of tokens (native or ERC-20) from one user to another within the contract.
     * @param from The address to transfer tokens from.
     * @param to The address to transfer tokens to.
     * @param token The token address (zero address for native currency).
     * @param amount The amount of tokens to transfer.
     */
    function transferFrom(address from, address to, address token, uint256 amount) public nonReentrant {
        _requireCanHandle(_msgSender(), from, token, amount);
        _tokenFunderBalances[token][from] -= amount;
        _tokenFunderBalances[token][to] += amount;
    }

    /**
     * @dev Ensures the operation can proceed based on the operator's role and balance, throwing errors if not.
     * @param operator The address attempting to perform the operation.
     * @param from The address from which tokens or Ether are being moved.
     * @param token The token address (zero address for native currency).
     * @param amount The amount of tokens or Ether to move.
     */
    function _requireCanHandle(address operator, address from, address token, uint256 amount) private view {
        bool hasSufficientBalance = (_tokenFunderBalances[token][from] >= amount);
        if (!hasSufficientBalance) revert InsufficientBalance();

        bool isOperatorTheOwner = (from == operator);
        bool isFundsAdmin = hasRole(FUNDS_ADMIN_ROLE, operator);

        if (!(isOperatorTheOwner || isFundsAdmin)) {
            revert Unauthorized();
        }
    }

    /**
     * @dev Retrieves the balance of a funder for a specific token.
     * @param funder The address of the funder whose balance is being queried.
     * @param token The token address (zero address for native currency).
     * @return The balance of the specified token for the funder.
     */
    function balanceOf(address funder, address token) public view returns (uint256) {
        return _tokenFunderBalances[token][funder];
    }

    /**
     * @dev Ensures that only an account with DEFAULT_ADMIN_ROLE can authorize contract upgrades.
     * @param newImplementation The address of the new contract implementation.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
