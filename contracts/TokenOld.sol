// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Token is ERC20, ERC20Burnable, AccessControl {

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    constructor(string memory _name, string memory _symbol) 
        ERC20(_name, _symbol) 
    {
        _mint(msg.sender, 300000000 * 10 ** 8);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function decimals() public pure override returns (uint8) {
        return 8;
    }

    /**
     * @dev Grant the Admin role to a specified account
     * @param adminAddress the address to which Admin permissions are set
     */
    function grantAdminRole(address adminAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setupRole(ADMIN_ROLE, adminAddress);
    }

}
