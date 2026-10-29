# 11 · Receive the safety certification estimate

This is the implementation demo for journey eleven. It is the real application and API running on this machine, with synthetic people and the local mail adapter, so nothing is charged or sent. It shows a mechanic's repair estimate becoming the buyer's report.

## Writing the estimate

After the call, the mechanic opens the estimate editor. Each finding is added in a dialog. A cost range with the high end below the low end is refused, and the dialog says why. Corrected, it is added. The mechanic lists the brake pads, the tires, the steering that passes, and a worn bushing. Each has a status and a cost range, or a dash when there is no cost. Submit estimate sends it, and the buyer can read it now.

## Reading the report

The buyer opens the report from the inspection. At the top is the cost to get the car safety certified, built from the required repairs only. Below it, the asking price and the all-in total show whether the deal is worth it. Every finding shows its status in words, not just colour. The page says this is not a safety certificate or a guarantee. The buyer downloads a PDF copy, and asks about a cost, which needs a reason.

## Sharing it

Now the buyer shares the report. The dialog makes a link that works for fourteen days. A mistyped address is refused. A valid one is sent through the local mail adapter. On the right, a browser with no account opens the link and reads the report, with no names or phone numbers from the buyer or the seller. Then the buyer turns the link off, and the same page now says the report isn't shared.

## The rules

The server enforces all of this. Writing the estimate before the call has ended is refused. The buyer cannot write it, and a reversed cost range is refused with its reason. A different buyer finds nothing, and so does an unknown link. The buyer who booked it gets the PDF.

## Recap

Here is what to remember. The mechanic writes the estimate once the call has ended. The buyer reads costs, an all-in total and a clear statement that it is not a certificate. Share links expire, and the buyer can turn them off. Not built yet: the body shop findings, notifications, and comparing cars. Next, journey twelve: conduct a body shop review.
