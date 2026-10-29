# 10 · Join a live video inspection

This is the implementation demo for journey ten. It is the real application and API running on this machine, with synthetic people and Chromium's fake camera and microphone. Nothing is recorded, charged or sent. It shows a buyer and a mechanic joining the same live video inspection.

## Joining the call

On the left is the buyer, and on the right is the mechanic, each in their own browser session. The buyer opens the booked inspection and chooses Join the call. The lobby checks the camera and microphone, and lists who is here. The mechanic and the seller have not joined yet. The buyer joins, and the mechanic does the same. Now each sees the other's live video, and the buyer is told that the mechanic joined. The video flows directly between the two browsers. The server only introduces them.

## Inspecting together

The mechanic runs the checklist. Marking brakes done moves the call on to tires, and the buyer's list changes at once. The mechanic adds a note, and it appears for the buyer. Only the mechanic has these two buttons. The buyer can watch, but cannot change the checklist.

## When the connection drops

Now the buyer's connection is cut. The call says so, and reconnects by itself, so the buyer keeps their place and the video comes back. If it could not reconnect after about six seconds, it would say disconnected and offer one click to rejoin. To finish, the buyer chooses End call. The dialog asks first, with Stay on the call selected, and says who will be disconnected. Ending is for everyone. Both sides see the call length, and what was checked and not checked.

## Who may join

The rules are enforced by the server, not just the screens. A buyer who is not on the inspection gets not found, so nothing about it is revealed. With no token, the answer is unauthorized. The buyer who booked it cannot run the checklist, and gets forbidden, while the mechanic can. Ending the call twice gives the same answer, and changes nothing.

## Recap

Here is what to remember. Two real sessions share one call, peer to peer. Only the people on the inspection can see it, and only the mechanic runs the checklist. A dropped connection recovers by itself, and ending a call ends it for everyone. Not built yet: recording, the seller joining from a text link, and calls across strict firewalls. Next, journey eleven: receive the safety certification estimate.
