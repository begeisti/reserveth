//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import '@openzeppelin/contracts/access/Ownable.sol';

contract Agenda is Ownable {

    // Full price of the service
    uint256 public priceOfService;
    // Duration of the service
    uint256 public duration;
    // Can cancel a booking before the start date of that minus the timestamp below
    uint256 cancellableBefore;
    mapping(uint256 => Booking) bookings;
    uint256[] bookableTimeSlots;

    struct Booking {
        address booker;
        uint256 payedAmount;
        bool confirmed;
    }
    event Booked(address booker, uint256 timestamp, uint256 payedAmount);
    event BookingConfirmed(address booker, uint256 timestamp);
    event BookingCancelled(address booker, uint256 timestamp, uint256 refundedAmount);

    constructor(uint256 _timestampOfFirstBooking, uint256 _timestampOfLastBooking, uint256 _priceOfService, uint256 _duration, uint256 _cancellableBefore) Ownable() {
        require(_timestampOfFirstBooking + _duration <= _timestampOfLastBooking, "Invalid time interval provided!");
        uint256 tmp = _timestampOfFirstBooking;
        while(tmp < _timestampOfLastBooking - _duration) {
            bookableTimeSlots.push(tmp);
            tmp += _duration;
        }
        priceOfService = _priceOfService;
        duration = _duration;
        cancellableBefore = _cancellableBefore;
    }

    function book(uint256 timestamp) public payable {
        require(_timeslotAvailable(timestamp), "The selected timeslot isn't available!");
        require(msg.value >= priceOfService, "Should pay the value of the service in order to make a booking!");
        bookings[timestamp] = Booking(msg.sender, msg.value, false);
        emit Booked(msg.sender, timestamp, msg.value);
    }

    function confirmBooking(uint256 timestamp) public onlyOwner {
        require(bookings[timestamp].booker != address(0), "The provided time isn't booked!");
        require(!bookings[timestamp].confirmed, "Booking already confirmed!");
        bookings[timestamp].confirmed = true;
        emit BookingConfirmed(msg.sender, timestamp);
    }

    function cancelBooking(uint256 timestamp) public {
        require(bookings[timestamp].booker == msg.sender, "Booking doesn't belong to you!");
        require(block.timestamp + cancellableBefore <= timestamp, "Too late to cancel this booking!");
        uint256 payedAmount = bookings[timestamp].payedAmount;
        address booker = bookings[timestamp].booker;
        delete bookings[timestamp];
        bool sent;
        // We don't care about the returned data, so we use this low-level assembly code to make the transfer
        // This won't the returned data into the memory, so this will use less gas
        assembly {
            sent := call(3000, booker, payedAmount, 0, 0, 0, 0)
        }
        require(sent, "Cannot refund booker!");
        emit BookingCancelled(booker, timestamp, payedAmount);
    }

    function getAvailableTimeSlots() public view returns (uint256[] memory) {
        Booking storage tmp;
        uint256 counter = 0;
        for (uint i = 0; i < bookableTimeSlots.length; ++i) {
            tmp = bookings[bookableTimeSlots[i]];
            if (tmp.booker == address(0)) {
                ++counter;
            }
        }
        uint256[] memory result = new uint256[](counter);
        counter = 0;
        for (uint i = 0; i < bookableTimeSlots.length; ++i) {
            tmp = bookings[bookableTimeSlots[i]];
            if (tmp.booker == address(0)) {
                result[counter++] = bookableTimeSlots[i];
            }
        }
        return result;
    }

    function _timeslotAvailable(uint256 bookingTime) internal view returns (bool) {
        if (bookingTime < bookableTimeSlots[0] || bookingTime > bookableTimeSlots[bookableTimeSlots.length - 1]) {
            return false;
        }
        uint256 diff = bookingTime - bookableTimeSlots[0];
        if (diff % duration == 0) {
            return bookings[bookingTime].booker == address(0);
        }
        return false;
    }

    function getMyBookings() public view returns (uint256[] memory, Booking[] memory) {
        Booking storage tmp;
        // We can only create fixed sized memory arrays, so we need to have the length of the new array beforehand
        uint256 counter = 0;
        for (uint i = 0; i < bookableTimeSlots.length; ++i) {
            tmp = bookings[bookableTimeSlots[i]];
            if (tmp.booker == msg.sender) {
                counter++;
            }
        }
        uint256[] memory timestamps = new uint256[](counter);
        Booking[] memory bookingInfo = new Booking[](counter);
        counter = 0;
        for (uint i = 0; i < bookableTimeSlots.length; ++i) {
            tmp = bookings[bookableTimeSlots[i]];
            if (tmp.booker == msg.sender) {
                timestamps[counter] = bookableTimeSlots[i];
                bookingInfo[counter] = tmp;
            }
        }
        return (timestamps, bookingInfo);
    }
}