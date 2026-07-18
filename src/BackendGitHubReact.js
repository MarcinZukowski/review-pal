/**
 * Backend for the new React-based GitHub "Files changed" view
 * (the /pull/N/changes URLs, rolled out per session since 2026).
 *
 * Differences from the classic view:
 * - per-file diffs are <table data-diff-anchor="diff-<hash>"> elements
 *   with aria-label="Diff for: <path>"
 * - rows are tr.diff-line-row, line numbers live in
 *   td.new-diff-line-number[data-diff-side=left|right][data-line-number]
 * - added/deleted code is <code class="... addition|deletion">
 * - there is no data-hunk; the table's data-diff-anchor is used as the
 *   diff tag instead (hunk headers still split diffs, as they are
 *   non-diff rows)
 */
class BackendGitHubReact extends BackendGitHub
{
    CODE_LINE_CLASS = "diff-text-inner";
    CODE_LINE_SELECTOR = "div.diff-text-inner";
    RESCAN_SELECTOR = "table[data-diff-anchor], tr.diff-line-row, copilot-diff-entry";

    diffContainerSelector()
    {
        return "[data-testid='diff-content']";
    }

    async initBar()
    {
        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        console.log("initBar (react)");
        let container;
        for (let r = 0; r < 20; r++) {
            container = $(this.diffContainerSelector());
            if (container.length) {
                break;
            }
            console.warn(`Can't find the diff container (attempt #${r + 1})`);
            await sleep(500);
        }
        if (container.length === 0) {
            console.error("Can't find the diff container");
            return;
        }
        console.log("Adding bar");
        container.prepend(`<div class="rp-bar rp-bar-github-react" id="${rpcore.barId}"/>`);

        let bar = $("#" + rpcore.barId);
        bar.html(this.barContentHTML());
        $("span.rp-button").on("click", rpcore.buttonPressed.bind(rpcore));
    }

    waitForDiffDone()
    {
        // React re-renders can wipe our bar, re-create it if needed
        rpcore.initBar();
        super.waitForDiffDone();
    }

    isDiff(row)
    {
        return $(row).find("code.addition, code.deletion").length > 0;
    }

    createDiffLine(row)
    {
        let jrow = $(row);
        let tag = jrow.closest("table").attr("data-diff-anchor") || "";
        let left = Number(jrow.find("td.new-diff-line-number[data-diff-side='left']").attr("data-line-number")) || 0;
        let right = Number(jrow.find("td.new-diff-line-number[data-diff-side='right']").attr("data-line-number")) || 0;
        return new DiffLine(tag, left, right, row);
    }

    getRowRanges(row)
    {
        let line = this.createDiffLine(row);
        return [line.left, line.right];
    }

    analyzeDiffs()
    {
        rpcore.diffs = [];
        let diff = null;
        let parent = this;
        let path = null;

        /** Finish diff if needed */
        function finishDiff()
        {
            if (diff) {
                rpcore.diffs.push(diff);
                parent.updateDiff(diff, false/*updateFile*/);
                // Finish diff
                diff = null;
            }
        }

        let perRow = function(index, row) {
            let diffLine = parent.createDiffLine(row);
            let isBreak = rpcore.data.breaks.indexOf(diffLine.id) >= 0;
            let isDiff = parent.isDiff(row);
            let first = (index === 0);

            if (!isDiff || isBreak || first) {
                finishDiff();
            }
            if (isDiff) {
                if (!diff) {
                    // New diff
                    diff = new DiffBlock(diffLine.tag);
                    diff.path = path;
                }
                // Update diff
                diff.addLine(diffLine);
            }
        };

        $("table[data-diff-anchor]").each(function(index, table) {
            path = ($(table).attr("aria-label") || "").replace(/^Diff for: /, "");
            console.log(`Analyzing ${path}`);
            $(table).find("tr.diff-line-row").each(perRow);
            finishDiff();
            parent.updateFile(path);
        });
    }

    findFileHeader(path)
    {
        let table = $(`table[aria-label="Diff for: ${path}"]`);
        return table.closest("div[id^='diff-']").find("[data-diff-header-wrapper] h3").parent();
    }

    addDiffHeader(diff)
    {
        let id = diff.getId();
        let isDone = rpcore.isDone(id);
        let imgHTML = isDone ? rpcore.greenHTML : rpcore.redHTML;
        let cell = $(diff.lines[0].row).find("td.new-diff-line-number").first();
        cell.find("img.rp-diff-marker").remove();
        cell.prepend(`<img ${imgHTML} width="20" height="20" class="rp-diff-marker ${id}"/>`);

        if (rpcore.data.breaks.indexOf(id) >= 0) {
            $(diff.lines[0].row).find("td").addClass("rp-forcedBreak");
        }
    }

    hideDiffHeader(diff)
    {
        $(diff.lines[0].row).find("img.rp-diff-marker").remove();
        $(diff.lines[0].row).find(".rp-forcedBreak").removeClass("rp-forcedBreak");
    }

    getParentRow(target)
    {
        if (target.parents("table[data-diff-anchor]").length === 0) {
            return null;
        }

        // Find parent TR
        let row = target.parents("tr.diff-line-row").get()[0];
        if (!row || !this.isDiff(row)) {
            return null;
        }
        return row;
    }

    foldAll()
    {
        rpcore.message("Fold all is not supported in the new GitHub view yet");
    }

    unfoldAll()
    {
        rpcore.message("Unfold all is not supported in the new GitHub view yet");
    }

    hideAllComments()
    {
        rpcore.message("Hiding comments is not supported in the new GitHub view yet");
    }

    unhideAllComments()
    {
        rpcore.message("Hiding comments is not supported in the new GitHub view yet");
    }
}
