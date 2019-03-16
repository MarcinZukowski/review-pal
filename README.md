# Crucible Diff Marker

A small Chrome extension that adds ability to mark individual changes (diff sections) 
inside a file as done / not done.

A result of roughly a day of work, it was fun to go blindly where I never ventured before 
(Chrome extensions, understanding Crucible pages, and refreshing JS a bit...)

## Functionality

* Marking individual changes as done / not done
* Manually breaking a change into smaller changes
  * How: Middle-click on the (2nd or later) line in a change to split or unsplit
  * Very useful for splitting huge changes (or entire new files) into smaller review units 
* Tracking per-file statistics of individual changes
* Ability to jump to the next done / todo change.
  * How: Click on "X diffs done" or "Y diffs to do" 
* Local browser persistence
* Ability to mark all changes as done/not done
* Automatically marking entire-file as reviewed once individual changes are reviewed

#### Disclaimer

* Only matches ``https://*/fisheye/cru/*`` URLs, 
  modify manifest.json if your Crucible is installed somewhere else
* Only tested on Crucible 4.5 !!!


#### Known issues

* Not updating when *View* parameters (e.g. lines of context, unified/side-by-side view etc.) are modified 

## Installation

* In Chrome, go to ``chrome://extensions/``
* Enable "Developer mode"
* Click "Load unpacked"
* Point to the ``src`` directory in this tree
* Done

## Example screenshot

![Example screenshot](cdm-example.png)

