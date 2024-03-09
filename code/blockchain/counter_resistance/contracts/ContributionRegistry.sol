// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @custom:security-contact hello@counter-resistance.org
contract ContributionRegistry is Initializable, ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable, ERC721PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    uint256 private _nextContributionId;
    mapping(uint256 => address) private _originalContributor;

    bytes32 public constant CONTRACT_PAUSER_ROLE = keccak256("CONTRACT_PAUSER_ROLE");
    bytes32 public constant CONTRACT_UPGRADER_ROLE = keccak256("CONTRACT_UPGRADER_ROLE");

    bytes32 public constant CONTRIBUTOR_ROLE = keccak256("CONTRIBUTOR_ROLE");
    bytes32 public constant CONTRIBUTOR_ROLE_MANAGER = keccak256("CONTRIBUTOR_ROLE_MANAGER");

    bytes32 public constant EXPERT_CONTRIBUTOR_ROLE = keccak256("EXPERT_CONTRIBUTOR_ROLE");
    bytes32 public constant EXPERT_CONTRIBUTOR_ROLE_MANAGER = keccak256("EXPERT_CONTRIBUTOR_ROLE_MANAGER");

    error Disabled();
    error NotContributor(address caller);
    error CannotContributeForOthers(address caller, address intendedContributor);
    error NotAuthorizedToUpdateMetadata(address caller, uint256 contributionId);

    event Contribution(address indexed by, address indexed to, uint256 indexed contributionId, string uri);

    event ContributionMetadataUpdated(address indexed by, uint256 indexed contributionId, string uri);

    event ContributorRoleGrantedByManager(address indexed grantedBy, address indexed contributor);
    event ContributorRoleRevokedByManager(address indexed revokedBy, address indexed contributor);

    event ExpertContributorRoleGrantedByManager(address indexed grantedBy, address indexed contributor);
    event ExpertContributorRoleRevokedByManager(address indexed revokedBy, address indexed contributor);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public virtual initializer {
        _nextContributionId = 1;

        __ERC721_init("Contribution registry", "CORE");
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __ERC721Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(CONTRACT_PAUSER_ROLE, _msgSender());
        _grantRole(CONTRACT_UPGRADER_ROLE, _msgSender());

        _grantRole(CONTRIBUTOR_ROLE_MANAGER, _msgSender());
        _grantRole(EXPERT_CONTRIBUTOR_ROLE_MANAGER, _msgSender());
    }

    //
    // Pausing/unpausing the contract.
    //

    function pause() public onlyRole(CONTRACT_PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(CONTRACT_PAUSER_ROLE) {
        _unpause();
    }

    //
    // Role management.
    //

    /**
     * @dev Grants the EXPERT_CONTRIBUTOR_ROLE, whether present or not.
     * Can only be called by an account with the EXPERT_CONTRIBUTOR_ROLE_MANAGER.
     * @param expertContributor Address of the new expert contributor to be granted the role.
     */
    function grantExpertContributorRole(address expertContributor) public onlyRole(EXPERT_CONTRIBUTOR_ROLE_MANAGER) {
        _grantRole(EXPERT_CONTRIBUTOR_ROLE, expertContributor);

        emit ExpertContributorRoleGrantedByManager(_msgSender(), expertContributor);
    }

    /**
     * @dev Revokes the EXPERT_CONTRIBUTOR_ROLE, whether present or not.
     * Can only be called by an account with the EXPERT_CONTRIBUTOR_ROLE_MANAGER.
     * @param expertContributor Address of the expert contributor to have the role revoked.
     */
    function revokeExpertContributorRole(address expertContributor) public onlyRole(EXPERT_CONTRIBUTOR_ROLE_MANAGER) {
        _revokeRole(EXPERT_CONTRIBUTOR_ROLE, expertContributor);

        emit ExpertContributorRoleRevokedByManager(_msgSender(), expertContributor);
    }

    /**
     * @dev Grants the CONTRIBUTOR_ROLE, whether present or not.
     * Can only be called by an account with the CONTRIBUTOR_ROLE_MANAGER.
     * @param contributor Address of the new contributor to be granted the role.
     */
    function grantContributorRole(address contributor) public onlyRole(CONTRIBUTOR_ROLE_MANAGER) {
        _grantRole(CONTRIBUTOR_ROLE, contributor);  // Does not emit if already granted

        emit ContributorRoleGrantedByManager(_msgSender(), contributor);
    }

    /**
     * @dev Revokes the CONTRIBUTOR_ROLE, whether present or not.
     * Can only be called by an account with the CONTRIBUTOR_ROLE_MANAGER.
     * @param contributor Address of the contributor to be revoked the role.
     */
    function revokeContributorRole(address contributor) public onlyRole(CONTRIBUTOR_ROLE_MANAGER) {
        _revokeRole(CONTRIBUTOR_ROLE, contributor);  // Does not emit if already revoked

        emit ContributorRoleRevokedByManager(_msgSender(), contributor);
    }

    //
    // Permissions.
    //

    /**
     * @dev Requires that the operator has permission to contribute.
     * Throws custom errors if the operator cannot contribute.
     * @param to The address for whom the contribution is being made.
     */
    function _requireCanContribute(address operator, address to) internal view virtual {
        bool isExpert = hasRole(EXPERT_CONTRIBUTOR_ROLE, operator);
        bool isContributor = hasRole(CONTRIBUTOR_ROLE, operator);

        if (!isExpert && !isContributor) {
            revert NotContributor(operator);
        }

        if (isContributor && (to != operator)) {
            revert CannotContributeForOthers(operator, to);
        }
    }

    /**
     * @dev Requires that the operator has permission to set or update the URI of a specific contribution.
     * This function checks if the operator is the current owner of the contribution and has a contributor role.
     * The usage of `ownerOf` is implicit existence check for the contribution.
     * Throws `NotAuthorizedToUpdateMetadata` if the operator is not authorized to update the metadata.
     * @param operator The address attempting to set or update the contribution URI.
     * @param contributionId The ID of the contribution whose URI is being set or updated.
     */
    function _requireCanSetURI(address operator, uint256 contributionId) internal view virtual {
        // Attempt to get the owner of the contribution to implicitly check if it exists.
        // This will revert if the contribution does not exist.
        address owner = ownerOf(contributionId);

        bool isOwner = (owner == operator);
        bool isExpertContributor = hasRole(EXPERT_CONTRIBUTOR_ROLE, operator);
        bool isRegularContributor = hasRole(CONTRIBUTOR_ROLE, operator);

        // doesn't matter:
        // bool isOriginalContributor = (_originalContributor[contributionId] == operator);

        if ((isRegularContributor || isExpertContributor) && isOwner) {
            return;
        }

        revert NotAuthorizedToUpdateMetadata(operator, contributionId);
    }

    /**
     * @dev Override _isAuthorized to include a role check for expert contributors.
     * This function assumes that `owner` is the actual owner of `tokenId` and does not verify this
     * assumption. It returns true if `spender` is allowed to manage the token.
     *
     * Only expert contributors are allowed to transfer tokens, specifically, one has to
     * be the owner and the original contributor, and have the EXPERT_CONTRIBUTOR_ROLE.
     * Regular contributors, even if they are original contributors, are not allowed to transfer.
     *
     * @param owner The owner of the token.
     * @param spender The address attempting to operate on the token.
     * @param tokenId The ID of the token in question.
     * @return A boolean indicating whether the spender is authorized to manage the token.
     */
    function _isAuthorized(address owner, address spender, uint256 tokenId) internal view virtual override returns (bool) {
        bool isOwner = (owner == spender);
        bool isExpertContributor = hasRole(EXPERT_CONTRIBUTOR_ROLE, spender);
        bool isOriginalContributor = (_originalContributor[tokenId] == spender);

        // Directly authorize the transfer if all are true:
        if (isOwner && isOriginalContributor && isExpertContributor) {
            return true;
        }

        super._isAuthorized;

        // Avoid any form of delegated transfer authority, to disallow
        // contributors from authorizing others to transfer their contributions.
        return false;
    }

    //
    // Data contribution (i.e., minting).
    //

    /**
     * @dev Internal function to handle contributions.
     * It calls `_requireCanContribute`, then "mints" a new contribution.
     * @param to The address for whom the contribution is being made.
     * @param uri The URI for the contribution metadata.
     * @return contributionId The ID of the newly minted contribution.
     */
    function _contribute(address to, string memory uri)
    internal
    virtual
    whenNotPaused
    returns (uint256 contributionId)
    {
        _requireCanContribute(_msgSender(), to);

        contributionId = _nextContributionId++;

        super._safeMint(to, contributionId);
        super._setTokenURI(contributionId, uri);

        _originalContributor[contributionId] = _msgSender();

        emit Contribution(_msgSender(), to, contributionId, uri);

        return contributionId;
    }

    /**
     * @dev Returns the original contributor of a specific contribution (even if it has been "burned").
     * If the contribution ID does not exist, returns the zero address.
     *
     * @param contributionId The ID of the contribution.
     * @return The address of the original contributor, or the zero address if ID does not exist.
     */
    function getOriginalContributor(uint256 contributionId) public view returns (address) {
        return _originalContributor[contributionId];
    }

    //
    // Contribution metadata.
    //

    /**
     * @dev Updates the URI for a specific contribution. This function allows the contribution's
     * metadata URI to be updated, but only by users with the necessary permissions. Expert
     * contributors can update the URI for any contribution, while regular contributors can only
     * update URIs for contributions they own. The function checks for the existence of the
     * contribution by attempting to retrieve its owner, which will revert if the contribution
     * does not exist.
     *
     * Requirements:
     * - The contract must not be paused.
     * - The caller must be an expert contributor or the owner of the contribution (for regular contributors).
     *
     * @param id The ID of the contribution whose URI is being updated.
     * @param uri The new URI string to be associated with the contribution.
     */
    function setMetadata(uint256 id, string memory uri) public whenNotPaused {
        _requireCanSetURI(_msgSender(), id);
        super._setTokenURI(id, uri);

        emit ContributionMetadataUpdated(_msgSender(), id, uri);
    }

    /**
     * @dev Preferred method for fetching contribution URIs, acting as a wrapper to {tokenURI}.
     * @param id uint256 ID of the contribution
     * @return string memory URI of the contribution
     */
    function metadata(uint256 id) public view returns (string memory) {
        return super.tokenURI(id);
    }

    //
    // Contract upgrade functionality.
    //

    function _authorizeUpgrade(address newImplementation)
    internal
    onlyRole(CONTRACT_UPGRADER_ROLE)
    override
    {}

    //
    // Overrides.
    //

    // Discourage the use of this function in derived contracts
    function _setTokenURI(uint256 /*tokenId*/, string memory /*uri*/) internal override pure {
        revert Disabled();
    }

    //
    // Overrides required by Solidity.
    //

    function _update(address to, uint256 tokenId, address auth)
    internal
    override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721PausableUpgradeable)
    returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
    internal
    override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable, AccessControlUpgradeable)
    returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Retrieves the URI for a given token ID, adhering to the ERC721 standard.
     * For direct contribution URI access, prefer using {contributionURI}.
     * @param tokenId uint256 ID of the token
     * @return string memory URI of the token
     */
    function tokenURI(uint256 tokenId)
    public  // for marketplaces like OpenSea
    view
    override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
    returns (string memory)
    {
        return  metadata(tokenId);
    }
}
