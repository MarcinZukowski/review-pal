/* A single block of diff data */
class DiffBlock
{
    constructor(tag)
    {
        this.tag = tag || "";
        this.left_from = 0;
        this.left_to = 0;
        this.right_from = 0;
        this.right_to = 0;
        this.rows = [];
    }

    addRow(row)
    {
        let [left, right] = dmcore.backend.getRowRanges(row);
        this.left_from = this.left_from || left;
        this.left_to = left || this.left_to;

        this.right_from = this.right_from || right;
        this.right_to = right || this.right_to;

        this.rows.push(row);
    }

    getId()
    {
        return DiffBlock.createId(this.left_from, this.right_from, this.tag);
    }

    toString()
    {
        return `Diff( left: ${this.left_from}-${this.left_to} right: ${this.right_from}-${this.right_to} tag: ${this.tag})`;
    }

    // Does this diff include a given row (based on its left-right row ranges)
    includes(left, right)
    {
        function helper(nr, from, to) {
            return nr === 0 || (from > 0 && nr >= from && nr <= to);
        }
        return helper(left, this.left_from, this.left_to) && helper(right, this.right_from, this.right_to);
    }

    static createId(left, right, tag)
    {
        tag = tag || "";
        return `diff_${tag}_${left}_${right}`;
    }

    static getRowId(row, tag)
    {
        tag = tag || "";
        let [left, right] = dmcore.backend.getRowRanges(row);
        return DiffBlock.createId(left, right, tag);
    }

    getNumLines()
    {
        return (this.left_from  > 0 ? 1 + this.left_to  - this.left_from  : 0)
            + (this.right_from > 0 ? 1 + this.right_to - this.right_from : 0);
    }
}
