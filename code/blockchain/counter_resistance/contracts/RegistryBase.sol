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
contract RegistryBase is Initializable, ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable, ERC721PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant CONTRACT_PAUSER_ROLE = keccak256("CONTRACT_PAUSER_ROLE");
    bytes32 public constant CONTRACT_UPGRADER_ROLE = keccak256("CONTRACT_UPGRADER_ROLE");

    bytes32 public constant CONTRIBUTOR_ROLE = keccak256("CONTRIBUTOR_ROLE");
    bytes32 public constant EXPERT_CONTRIBUTOR_ROLE = keccak256("EXPERT_CONTRIBUTOR_ROLE");

    uint256 private _nextTokenId;

    event ContributorRoleGrantedByExpert(address indexed grantedBy, address indexed contributor);
    event ContributorRoleRevokedByExpert(address indexed revokedBy, address indexed contributor);

    event ContributionMetadataUpdated(address indexed who, uint256 indexed contributionId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() virtual initializer public {
        _nextTokenId = 1;

        __ERC721_init("Contribution registry", "CORE");
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __ERC721Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(CONTRACT_PAUSER_ROLE, _msgSender());
        _grantRole(CONTRACT_UPGRADER_ROLE, _msgSender());

        _grantRole(EXPERT_CONTRIBUTOR_ROLE, _msgSender());
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

    // TODO: add grantExpertContributorRole

    /**
     * @dev Grants the CONTRIBUTOR_ROLE to a new contributor.
     * Can only be called by an account with the EXPERT_CONTRIBUTOR_ROLE.
     * @param contributor Address of the new contributor to be granted the role.
     */
    function grantContributorRole(address contributor) public onlyRole(EXPERT_CONTRIBUTOR_ROLE) {
        _grantRole(CONTRIBUTOR_ROLE, contributor);  // Does not emit if already granted

        emit ContributorRoleGrantedByExpert(_msgSender(), contributor);
    }

    /**
     * @dev Revokes the CONTRIBUTOR_ROLE from an existing contributor.
     * Can only be called by an account with the EXPERT_CONTRIBUTOR_ROLE.
     * @param contributor Address of the contributor to be revoked the role.
     */
    function revokeContributorRole(address contributor) public onlyRole(EXPERT_CONTRIBUTOR_ROLE) {
        _revokeRole(CONTRIBUTOR_ROLE, contributor);  // Does not emit if already revoked

        emit ContributorRoleRevokedByExpert(_msgSender(), contributor);
    }

    //
    // Contribution.
    //

    function contributeFor(address to, string memory uri)
    public
    whenNotPaused
    onlyRole(EXPERT_CONTRIBUTOR_ROLE)
    returns (uint256)
    {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        return tokenId;
    }

    function contribute(string memory uri)
    public
    whenNotPaused
    onlyRole(CONTRIBUTOR_ROLE)
    returns (uint256)
    {
        uint256 tokenId = _nextTokenId++;
        _safeMint(_msgSender(), tokenId);
        _setTokenURI(tokenId, uri);

        return tokenId;
    }

    //
    // Contribution metadata.
    //

    function setContributionURI(uint256 contributionId, string memory uri) public whenNotPaused {
        // Attempt to get the owner of the contribution to implicitly check if it exists.
        // This will revert if the contribution does not exist.
        address owner = ownerOf(contributionId);

        require(
            hasRole(EXPERT_CONTRIBUTOR_ROLE, _msgSender()) ||
            (hasRole(CONTRIBUTOR_ROLE, _msgSender()) && owner == _msgSender()),
            "Not authorized to setContributionURI"
        );

        _setTokenURI(contributionId, uri);

        emit ContributionMetadataUpdated(_msgSender(), contributionId);
    }

    /**
     * @dev Preferred method for fetching contribution URIs, acting as a wrapper to {tokenURI}.
     * @param contributionId uint256 ID of the contribution
     * @return string memory URI of the contribution
     */
    function contributionURI(uint256 contributionId) public view returns (string memory) {
        return tokenURI(contributionId);
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
    public
    view
    override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
    returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
}
