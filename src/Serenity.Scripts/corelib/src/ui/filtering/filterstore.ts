﻿import { Decorators } from "../../decorators";
import { ArgumentNullException, Criteria, Culture, delegateCombine, delegateRemove, PropertyItem, text, tryGetText } from "../../q";
import { FilterLine } from "./filterline";

@Decorators.registerClass('FilterStore')
export class FilterStore {

    constructor(fields: PropertyItem[]) {

        this.items = [];

        if (fields == null) {
            throw new ArgumentNullException('source');
        }

        this.fields = fields.slice();

        this.get_fields().sort(function (x, y) {
            var titleX = tryGetText(x.title);
            if (titleX == null) {
                titleX = x.title;
                if (titleX == null)
                    titleX = x.name;
            }

            var titleY = tryGetText(y.title);
            if (titleY == null) {
                titleY = y.title;
                if (titleY == null)
                    titleY = y.name;
            }

            return Culture.stringCompare(titleX, titleY);
        });

        this.fieldByName = {};

        for (var field of fields) {
            this.get_fieldByName()[field.name] = field;
        }
    }

    static getCriteriaFor(items: FilterLine[]): any[] {

        if (items == null)
            return [''];

        var inParens = false;
        var currentBlock = [''];
        var isBlockOr = false;
        var criteria = [''];

        for (var i = 0; i < items.length; i++) {
            var line = items[i];

            if (line.leftParen || inParens && line.rightParen) {

                if (!Criteria.isEmpty(currentBlock)) {

                    if (inParens)
                        currentBlock = Criteria.paren(currentBlock);

                    if (isBlockOr)
                        criteria = Criteria.join(criteria,
                            'or', currentBlock);
                    else
                        criteria = Criteria.join(criteria,
                            'and', currentBlock);

                    currentBlock = [''];
                }

                inParens = false;
            }

            if (line.leftParen) {
                isBlockOr = line.isOr;
                inParens = true;
            }

            if (line.isOr)
                currentBlock = Criteria.join(currentBlock,
                    'or', line.criteria);
            else
                currentBlock = Criteria.join(currentBlock,
                    'and', line.criteria);
        }

        if (!Criteria.isEmpty(currentBlock)) {
            if (isBlockOr)
                criteria = Criteria.join(criteria,
                    'or', Criteria.paren(currentBlock));
            else
                criteria = Criteria.join(criteria,
                    'and', Criteria.paren(currentBlock));
        }

        return criteria;
    }

    static getDisplayTextFor(items: FilterLine[]): string {

        if (items == null)
            return '';

        var inParens = false;
        var displayText = '';

        for (var i = 0; i < items.length; i++) {
            var line = items[i];

            if (inParens && (line.rightParen || line.leftParen)) {
                displayText += ')';
                inParens = false;
            }

            if (displayText.length > 0) {
                displayText += ' ' + text('Controls.FilterPanel.' +
                    (line.isOr ? 'Or' : 'And')) + ' ';
            }

            if (line.leftParen) {
                displayText += '(';
                inParens = true;
            }

            displayText += line.displayText;
        }

        if (inParens) {
            displayText += ')';
        }

        return displayText;
    }

    private changed: any;
    private displayText: string;
    private fields: PropertyItem[];
    private fieldByName: { [key: string]: PropertyItem }
    private items: FilterLine[];

    get_fields(): PropertyItem[] {
        return this.fields;
    }

    get_fieldByName(): { [key: string]: PropertyItem } {
        return this.fieldByName;
    }

    get_items(): FilterLine[] {
        return this.items;
    }

    raiseChanged(): void {
        this.displayText = null;
        this.changed && this.changed(this, {});
    }

    add_changed(value: (e: JQueryEventObject, a: any) => void): void {
        this.changed = delegateCombine(this.changed, value);
    }

    remove_changed(value: (e: JQueryEventObject, a: any) => void): void {
        this.changed = delegateRemove(this.changed, value);
    }

    get_activeCriteria(): any[] {
        return FilterStore.getCriteriaFor(this.items);
    }

    get_displayText(): string {
        if (this.displayText == null)
            this.displayText = FilterStore.getDisplayTextFor(this.items);
        
        return this.displayText;
    }
}