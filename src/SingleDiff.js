/* A single diff data */
class SingleDiff
{
    constructor()
    {
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
        return SingleDiff.createId(this.left_from, this.right_from);
    }
    toString()
    {
        return `Diff( left: ${this.left_from}-${this.left_to} right: ${this.right_from}-${this.right_to} )`;
    }

    // Does this diff include a given row (based on its left-right row ranges)
    includes(left, right)
    {
        function helper(nr, from, to) {
            return nr === 0 || (from > 0 && nr >= from && nr <= to);
        }
        return helper(left, this.left_from, this.left_to) && helper(right, this.right_from, this.right_to);
    }

    static createId(left, right)
    {
        return `diff_${left}_${right}`;
    }
    static getRowId(row)
    {
        let [left, right] = dmcore.backend.getRowRanges(row);
        return SingleDiff.createId(left, right);
    }
    getNumLines()
    {
        return (this.left_from  > 0 ? 1 + this.left_to  - this.left_from  : 0)
            + (this.right_from > 0 ? 1 + this.right_to - this.right_from : 0);
    }
}
