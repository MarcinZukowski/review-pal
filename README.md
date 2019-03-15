# Crucible Diff Marker

A small Chrome extension that adds ability to mark individual diffs inside a file as done / not done.

A result of roughly a day of work, it was fun to go blindly where I never ventured before 
(Chrome extensions, understanding Crucible pages, and refreshing JS a bit...)

## Functionality

* Marking individual changes as done / not done
* Manually breaking a diff into smaller diffs
  * How: Middle-click on the line number column to split or unsplit
  * Useful for splitting huge changes (or entire files) into smaller units 
* Tracking per-file statistics of individual changes
* Local browser persistence
* Ability to mark all changes as done/not done
* Automatically marking entire-file as reviewed once individual changes are reviewed

#### Disclaimer

* Only matches ``https://*/fisheye/cru/*`` URLs, modify manifest.json if your Crucible is installed somewhere else
* Only tested on Crucible 4.5 !!!


#### Known issues

* Not updating when *View* parameters (e.g. lines of context, unified/side-by-side view etc.) are modified 

## Installation

* In Chrome, go to ``chrome://extensions/``
* Enable "Developer mode"
* Click "Load unpacked"
* Point to ``src`` directory in this tree
* Done

## Example screenshot

![Example screenshot](cdm-example.png)

