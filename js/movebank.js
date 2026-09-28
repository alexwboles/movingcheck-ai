/* MovingCheck AI — 8-week moving checklist template + room list. UMD: browser globals or Node exports. */

var MOVE_ROOMS = [
  "Living room", "Kitchen", "Bedroom", "Bathroom", "Home office",
  "Kids' room", "Dining room", "Laundry", "Garage", "Basement / Attic", "Hallway / Storage"
];

/* week = weeks before moving day. 0 = moving day itself. */
var CHECKLIST_TEMPLATE = [
  // 8 weeks out — declutter & research
  { week: 8, cat: "Declutter", task: "Declutter every room — donate, sell, or toss what you won't move" },
  { week: 8, cat: "Research", task: "Research moving companies and read reviews" },
  { week: 8, cat: "Admin", task: "Create a moving folder for quotes, receipts, and checklists" },
  { week: 8, cat: "Admin", task: "Notify your landlord if renting (check notice period)" },
  { week: 8, cat: "Plan", task: "Measure large furniture and doorways at the new place" },
  // 7 weeks — supplies
  { week: 7, cat: "Packing", task: "Gather packing supplies: boxes, tape, bubble wrap, markers" },
  { week: 7, cat: "Packing", task: "Start packing non-essentials (books, decor, off-season items)" },
  { week: 7, cat: "Admin", task: "Photograph valuables for insurance records" },
  { week: 7, cat: "Admin", task: "Request time off work for moving day" },
  // 6 weeks — pack storage areas
  { week: 6, cat: "Packing", task: "Pack storage areas first: garage, basement, attic" },
  { week: 6, cat: "Declutter", task: "Hold a yard sale or list big items for sale online" },
  { week: 6, cat: "Admin", task: "Arrange transfer of school / medical records" },
  { week: 6, cat: "Plan", task: "Start using up pantry, freezer, and cleaning supplies" },
  // 5 weeks — address changes & booking
  { week: 5, cat: "Admin", task: "File a change of address with the postal service" },
  { week: 5, cat: "Admin", task: "Update address: bank, subscriptions, voter registration, license" },
  { week: 5, cat: "Research", task: "Get written quotes and book your mover (or reserve a truck)" },
  { week: 5, cat: "Packing", task: "Pack seasonal and rarely-used items" },
  // 4 weeks — utilities & insurance
  { week: 4, cat: "Admin", task: "Schedule utility shut-off / turn-on (electric, water, gas, internet)" },
  { week: 4, cat: "Admin", task: "Update renters / homeowners insurance for the new address" },
  { week: 4, cat: "Packing", task: "Pack the garage and tools (drain fuel from equipment)" },
  { week: 4, cat: "Plan", task: "Confirm moving-day helpers and share the plan" },
  // 3 weeks — room-by-room packing
  { week: 3, cat: "Packing", task: "Pack the kitchen except daily essentials" },
  { week: 3, cat: "Packing", task: "Label every box with room + contents + fragile" },
  { week: 3, cat: "Packing", task: "Disassemble furniture; bag and label screws" },
  { week: 3, cat: "Plan", task: "Arrange pet / child care for moving day" },
  // 2 weeks — essentials & confirmations
  { week: 2, cat: "Packing", task: "Pack the FIRST-NIGHT essentials box (see Boxes tab)" },
  { week: 2, cat: "Admin", task: "Confirm mover arrival time and parking access" },
  { week: 2, cat: "Packing", task: "Clean rooms as you finish emptying them" },
  { week: 2, cat: "Admin", task: "Back up important documents digitally" },
  // 1 week — final prep
  { week: 1, cat: "Packing", task: "Defrost the freezer and empty the fridge" },
  { week: 1, cat: "Packing", task: "Pack suitcases with a week's worth of clothes" },
  { week: 1, cat: "Plan", task: "Do a final walkthrough checklist of the old place" },
  { week: 1, cat: "Plan", task: "Charge your phone and keep a basic toolkit handy" },
  // Moving day
  { week: 0, cat: "Moving day", task: "Keep the essentials box with you — not in the truck" },
  { week: 0, cat: "Moving day", task: "Photograph utility meter readings at both places" },
  { week: 0, cat: "Moving day", task: "Final lock-up check: closets, attic, garage, mailbox" },
  { week: 0, cat: "Moving day", task: "Tip movers and do a last walkthrough" }
];

var FIRST_NIGHT_SUGGESTIONS = [
  "Toilet paper", "Phone chargers", "Bedding + pillows", "Towels",
  "Toiletries + medications", "Change of clothes", "Snacks + water",
  "Basic tools (screwdriver, box cutter)", "Trash bags", "Paper towels",
  "Coffee maker / kettle", "Important documents folder"
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MOVE_ROOMS, CHECKLIST_TEMPLATE, FIRST_NIGHT_SUGGESTIONS };
}
