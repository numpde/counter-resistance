// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../ContributionRegistry.sol";

contract TestContributionRegistry is ContributionRegistry {
    function onlyCompanion_test() external onlyCompanion view returns (bool) {
        return true;
    }

    function requireCanContribute(address operator, address to) external view {
        super._requireCanContribute(operator, to);
    }


    function requireCanSetURI(address operator, uint256 contributionId) external view {
        super._requireCanSetURI(operator, contributionId);
    }

    function isAuthorized(address owner, address spender, uint256 tokenId) external view returns (bool) {
        return super._isAuthorized(owner, spender, tokenId);
    }

    function isTestContributionRegistry() external view returns (bool) {
        return true;
    }
}
