# Annual Leave Plan User Flow

This document defines the mobile user flow for creating an annual leave plan before submitting an actual leave request.

## Goal

Help staff understand what they are about to do before they start selecting leave dates.

The create plan screen should first show a simple three-step instruction flow. After the last step, the staff can start creating the leave plan.

## When To Show

Show the instruction flow when:

- the staff opens `Create leave plan`; and
- no leave plan period has been added yet.

Do not show the instruction flow once the staff has started adding plan periods in the current session.

## Step 1: Know Your Leave Limit

Title:

```txt
Know Your Leave Limit
```

Message:

```txt
You are entitled to {entitledDays} days of annual leave for {leaveYear}. Your planned leave periods must stay within this limit.
```

Primary action:

```txt
Next
```

## Step 2: Split Your Leave

Title:

```txt
Split Your Leave
```

Message:

```txt
You can split your annual leave into up to 3 separate periods. Add one period at a time and confirm the dates before adding another.
```

Primary action:

```txt
Next
```

## Step 3: Check And Submit

Title:

```txt
Check And Submit
```

Message:

```txt
We will check weekends, holidays, unavailable dates, and your remaining days. Submit your plan once the periods look correct. HR approval is required before you can request leave.
```

Primary action:

```txt
Create Leave Plan
```

## Expected Screen Behavior

- The instruction flow should feel like a mobile splash/onboarding flow.
- Show one step per screen state.
- Use a clear step indicator.
- Keep copy short and readable.
- Do not show all instructions at once.
- The last button should transition into the actual plan creation UI.
- The actual plan creation UI keeps the existing behavior:
  - tap plus to add a period;
  - select start and end dates;
  - verify the period;
  - confirm the period;
  - optionally add another period;
  - submit the verified plan.

