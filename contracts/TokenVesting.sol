// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TokenVesting
 */
contract TokenVesting is AccessControl, ReentrancyGuard {

    // 1 slot
    uint32 start; // start time of the vesting period 
    uint16 slicePeriodDays; // duration of a slice period for the vesting in days
    address public tokenAddress;
    // 2 slot
    uint256 public vestingSchedulesTotalAmount;

    // Takes 2 slots :(
    struct VestingSchedule {
        uint8 cliffDays; 
        uint16 durationDays; // duration of the vesting period in days
        uint112 amountTotal; // total amount of tokens WITHOUT! amountAfterCliff to be released at the end of the vesting
        uint112 released; // amount of tokens released
        //
        uint112 amountAfterCliff;
    }

    mapping(address => VestingSchedule) private vestingSchedules;

    /**
     * @dev Throws if called by any accounts other than the SA (stage adjustment) or admin.
     */
    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not an admin ");
        _;
    }

    event Clamed(address indexed beneficiary, uint256 amount);
    event ScheduleCreated(address indexed beneficiary, uint16 durationDays, uint112 amount);
    event WithdrawedByAdmin(uint256 amount);

    /**
     * @dev Creates a vesting contract.
     * @param _token address of the ERC20 token contract
     */
    constructor(address _token) {
        require(_token != address(0x0));
        tokenAddress = _token;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        start = 1685221200; // 28.05.2023 GMT 
        slicePeriodDays = 30; 
    }
    
    
    /**
     * @notice Withdraw the specified amount if possible. Can be used by admin in case of emergency !!!
     * @param _amount the amount to withdraw
     */
    function withdraw(uint256 _amount) external onlyAdmin {
        _safeTransfer(tokenAddress, msg.sender, _amount);
        emit WithdrawedByAdmin(_amount);
    }

    /**
     * @notice Creates a new vesting schedule for a beneficiary.
     * @param _beneficiary address of the beneficiary to whom vested tokens are transferred
     * @param _durationDays duration in days of the period in which the tokens will vest
     * @param _cliffDays duration in days of cliff
     * @param _amountTotal total amount of tokens to be released at the end of the vesting
     * @param _amountAfterCliff amount after cliff
     */
    function createVestingSchedule(
        address _beneficiary,
        uint16 _durationDays,
        uint8 _cliffDays,
        uint112 _amountTotal,
        uint112 _amountAfterCliff
    ) external onlyAdmin {

        require(_durationDays > 0, "TokenVesting: duration must be > 0");
        require(_amountTotal > 0, "TokenVesting: amount must be > 0");
        require(_durationDays >= uint16(_cliffDays), "TokenVesting: duration must be >= cliff");
        vestingSchedules[_beneficiary] = VestingSchedule(_cliffDays, _durationDays, _amountTotal, 0, _amountAfterCliff);
        vestingSchedulesTotalAmount += _amountTotal;

        emit ScheduleCreated(_beneficiary, _durationDays, _amountTotal);
    }

    /**
     * @notice claim vested amount of tokens.
     */
    function claim() external nonReentrant {

        VestingSchedule storage vestingSchedule = vestingSchedules[msg.sender];
        require(vestingSchedule.amountTotal > 0, "TokenVesting: only beneficiary can claim");
        uint256 vestedAmount = _computeReleasableAmount(vestingSchedule);
        vestingSchedule.released += (uint112(vestedAmount) - vestingSchedule.amountAfterCliff);  // amountAfterCliff - could not be > vestedAmount, because it used in calculation of vestedAmount
        vestingSchedule.amountAfterCliff = 0;
        vestingSchedulesTotalAmount -= vestedAmount;
        _safeTransfer(tokenAddress, msg.sender, vestedAmount);

        emit Clamed(msg.sender, vestedAmount);

    }


    /**
     * @notice Computes the vested amount of tokens for the given vesting schedule identifier.
     * @return the vested amount
     */
    function computeReleasableAmount(address _beneficiary) external view returns (uint256) {
        return _computeReleasableAmount(vestingSchedules[_beneficiary]);
    }

    /**
     * @notice Returns the vesting schedule information for a given identifier.
     * @return the vesting schedule structure information
     */
    function getVestingSchedule(address _beneficiary) external view returns (VestingSchedule memory) {
        return vestingSchedules[_beneficiary];
    }

    /**
     * @dev Returns the amount of tokens that can be withdrawn by the owner.
     * @return the amount of tokens
     */
    function getWithdrawableAmount() external view returns (uint256) {
        return _balanceOf(tokenAddress, address(this)) - vestingSchedulesTotalAmount;
    }

    /**
     * @dev Computes the releasable amount of tokens for a vesting schedule.
     * @return the amount of releasable tokens
     */
    function _computeReleasableAmount(VestingSchedule memory vestingSchedule) internal view returns (uint256) {

        uint32 currentTime = uint32(block.timestamp);
        // If the current time is before the cliff, no tokens are releasable.
        uint32 cliffDuration = (uint32(vestingSchedule.cliffDays) * 86400);
        if (currentTime < start + cliffDuration) {
            return 0;
        }
        // If the current time is after the vesting period, all tokens are releasable,
        // minus the amount already released.
        else if (
            currentTime >= start + (uint32(vestingSchedule.durationDays) * 86400)
        ) {
            return uint256(vestingSchedule.amountTotal + vestingSchedule.amountAfterCliff - vestingSchedule.released);
        }
        // Otherwise, some tokens are releasable.
        else {       
            uint32 vestedSlicePeriods = (currentTime - start) / (uint32(slicePeriodDays) * 86400); // Compute the number of full vesting periods that have elapsed.
            uint32 vestedSeconds = vestedSlicePeriods * (uint32(slicePeriodDays) * 86400);            
            uint256 vestedAmount = (vestingSchedule.amountTotal * uint256(vestedSeconds)) / (uint256(vestingSchedule.durationDays) * 86400); // Compute the amount of tokens that are vested.
            return vestedAmount + uint256(vestingSchedule.amountAfterCliff) - uint256(vestingSchedule.released); // Subtract the amount already released and return.
        }
    }

    function _safeTransfer(address _token, address _to, uint256 _value) internal {
        // Transfer selector `bytes4(keccak256(bytes('transfer(address,uint256)')))` should be equal to 0xa9059cbb
        (bool success, bytes memory data) = _token.call(abi.encodeWithSelector(0xa9059cbb, _to, _value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }

    function _balanceOf(address _token, address _account) internal view returns(uint) {
        // balanceOf selector `bytes4(keccak256('balanceOf(address)'))` should be equal to 0x70a08231
        (, bytes memory data) = _token.staticcall(abi.encodeWithSelector(0x70a08231, _account));
        return abi.decode(data, (uint));
    }

}