/**
 * Copyright © INOVUA TRADING.
 *
 * This source code is licensed under the Commercial License found in the
 * LICENSE file in the root directory of this source tree.
 */
import React, { createRef } from 'react';
import Region from '@inovua/reactdatagrid-community/packages/region';
import InovuaDataGridColumnLayout from '@inovua/reactdatagrid-community/Layout/ColumnLayout';
import DragRow from './plugins/row-reorder/DragRow';
import DragRowArrow from './plugins/row-reorder/DragRowArrow';
import ScrollingRegion from './plugins/row-reorder/ScrollingRegion';
import getRangesForRows from './plugins/row-reorder/utils/getRangesForRows';
import setupRowDrag from './plugins/row-reorder/utils/setupRowDrag';
import getDropRowIndex from './plugins/row-reorder/utils/getDropRowIndex';
import moveXBeforeY from '@inovua/reactdatagrid-community/utils/moveXBeforeY';
import dropIndexValidation from './plugins/row-reorder/utils/dropIndexValidation';
import LockedRows from './plugins/locked-rows/LockedRows';
import getRangesForGroups from './plugins/row-reorder/utils/getRangesForGroups';
import dropGroupIndexValidation from './plugins/row-reorder/utils/dropGroupIndexValidation';
import getDropGroup from './plugins/row-reorder/utils/getDropGroup';
let DRAG_INFO = null;
let scrolling = false;
const SCROLL_MARGIN = 40;
const DRAG_ROW_MAX_HEIGHT = 100;
const raf = global.requestAnimationFrame;
export default class InovuaDataGridEnterpriseColumnLayout extends InovuaDataGridColumnLayout {
    dropIndex;
    dragBoxInitialHeight = 0;
    dropRowHeight = 0;
    validDropPositions = [];
    scrollTopRegionRef;
    scrollBottomRegionRef;
    dragRowArrow;
    refDragRow;
    refDragRowArrow;
    dragRow;
    content;
    gridScrollInterval;
    constructor(props) {
        super(props);
        this.refDragRow = (row) => {
            this.dragRow = row;
        };
        this.refDragRowArrow = (dragRow) => {
            this.dragRowArrow = dragRow;
        };
        this.scrollTopRegionRef = createRef();
        this.scrollBottomRegionRef = createRef();
    }
    renderLockedEndRows = (computedProps) => {
        return this.renderLockedRows(computedProps.computedLockedEndRows, 'end', computedProps);
    };
    renderLockedStartRows = (computedProps) => {
        return this.renderLockedRows(computedProps.computedLockedStartRows, 'start', computedProps);
    };
    renderLockedRows = (rows, position, computedProps) => {
        if (!rows || !rows.length) {
            return null;
        }
        return (React.createElement(LockedRows, { key: position, rows: rows, computedProps: computedProps, position: position }));
    };
    renderDragRowArrow = () => {
        const props = this.lastComputedProps;
        const { rowReorderArrowStyle } = props;
        return (React.createElement(DragRowArrow, { ref: this.refDragRowArrow, rowHeight: this.dropRowHeight, rowReorderArrowStyle: rowReorderArrowStyle }));
    };
    renderReorderRowProxy = (props) => {
        return (React.createElement(DragRow, { ref: this.refDragRow, renderRowReorderProxy: props && props.renderRowReorderProxy }));
    };
    renderScrollingTopRegion = () => {
        return (React.createElement(ScrollingRegion, { ref: this.scrollTopRegionRef, dir: -1, onMouseEnter: (event) => this.onScrollingRegionMouseEnter(event, -1), onMouseLeave: this.onScrollingRegionMouseLeave }));
    };
    renderScrollingBottomRegion = () => {
        return (React.createElement(ScrollingRegion, { ref: this.scrollBottomRegionRef, dir: 1, onMouseEnter: (event) => this.onScrollingRegionMouseEnter(event, 1), onMouseLeave: this.onScrollingRegionMouseLeave }));
    };
    onScrollingRegionMouseEnter = (event, dir) => {
        event.preventDefault();
        if (DRAG_INFO && DRAG_INFO.dragging) {
            scrolling = true;
            const props = this.lastComputedProps;
            const { rowReorderScrollByAmount, rowReorderAutoScrollSpeed } = props;
            if (scrolling && dir) {
                global.clearInterval(this.gridScrollInterval);
                this.gridScrollInterval = global.setInterval(() => this.startScrolling(rowReorderScrollByAmount, dir), rowReorderAutoScrollSpeed);
            }
        }
    };
    startScrolling = (rowReorderScrollByAmount, dir) => {
        const initialScrollTop = this.getScrollTop();
        const newScrollTop = initialScrollTop + dir * rowReorderScrollByAmount;
        raf(() => {
            this.setScrollPosition(newScrollTop);
        });
    };
    setScrollPosition = (scrollTop) => {
        const scrollTopMax = this.getScrollTopMax();
        this.setReorderArrowVisible(false);
        if (scrollTop < 0) {
            scrollTop = 0;
        }
        if (scrollTop > scrollTopMax) {
            scrollTop = scrollTopMax;
        }
        this.setScrollTop(scrollTop);
    };
    onScrollingRegionMouseLeave = () => {
        scrolling = false;
        this.setReorderArrowVisible(true);
        global.clearInterval(this.gridScrollInterval);
    };
    getDragRowInstance = (dragIndex) => {
        const visibleRows = this.getContentRows();
        const dragRow = visibleRows.filter((row) => {
            if (!row) {
                return;
            }
            return row.props.rowIndex === dragIndex;
        })[0];
        return dragRow;
    };
    onDragRowMouseDownHandle = (ev, index, cellNode) => {
        const dragIndex = index;
        const props = this.lastComputedProps;
        if (!this.onRowReorderValidation(ev, props, dragIndex)) {
            return;
        }
        const { computedFocused, computedSetFocused, setActiveIndex } = props;
        const { contentRegion, headerHeight, cellRegion } = this.initDrag({
            cellNode,
        });
        this.dragRowArrow.setOffset(headerHeight);
        if (!computedFocused) {
            computedSetFocused(true);
        }
        setActiveIndex(index);
        this.setupDrag(ev, { dragIndex, contentRegion, headerHeight, cellRegion }, props);
    };
    setupDrag = (event, { dragIndex, contentRegion, headerHeight, cellRegion, }, props) => {
        const { dragBoxInitialRegion, dragRowHeight, } = this.getDragBoxInitialRegion({
            dragIndex,
        });
        const { dragProxy, dragProxyPosition, dragBoxOffsets, leftBoxOffset, } = this.getDragProxy(props, {
            dragIndex,
            contentRegion,
            cellRegion,
            dragBoxInitialRegion,
        });
        this.setScrollRegionVisibility();
        dragProxy.setHeight(dragRowHeight);
        dragProxy.setTop(dragProxyPosition.top);
        dragProxy.setLeft(dragProxyPosition.left);
        const initialScrollTop = this.getScrollTop();
        const { ranges, selectedGroup } = this.getRanges(props, {
            initialScrollTop,
            contentRegion,
            dragBoxInitialRegion,
        });
        DRAG_INFO = {
            dragging: true,
            dragIndex,
            ranges,
            selectedGroup,
            contentRegion,
            headerHeight,
            dragBoxInitialRegion,
            dragBoxRegion: dragBoxInitialRegion.clone(),
            dragProxy,
            dragBoxOffsets,
            initialScrollTop,
            leftBoxOffset,
            scrollTopMax: this.getScrollTopMax(),
        };
        this.setReorderArrowAt(dragIndex, ranges);
        setupRowDrag(event, dragBoxInitialRegion, {
            onDrag: (event, config) => this.onRowDrag(event, config, props),
            onDrop: (event, config) => this.onRowDrop(event, config, props),
        });
    };
    onRowDrag = (_event, config, props) => {
        if (!DRAG_INFO) {
            return;
        }
        const { dragIndex, dragBoxInitialRegion, dragProxy, dragBoxOffsets, } = DRAG_INFO;
        const { initialDiffTop, initialDiffLeft, dragProxyAjust, scrollDiff, scrollTop, diffTop, diffLeft, } = this.adjustScrollOnDrag(props, config);
        const { dragProxyTop, dragProxyLeft } = this.ajustDragProxy({
            diffTop,
            diffLeft,
            initialDiffTop,
            initialDiffLeft,
            dragProxyAjust,
        });
        dragProxy.setTop(dragProxyTop);
        dragProxy.setLeft(dragProxyLeft);
        dragProxy.setVisible(true);
        let dropIndex = -1;
        let dir = initialDiffTop > 0 ? 1 : -1;
        const { rowHeightManager, computedGroupBy } = props;
        const { index: newDropIndex } = getDropRowIndex({
            rowHeightManager,
            dragBoxInitialRegion,
            dragBoxOffsets,
            initialDiffTop,
            scrollTop,
            dragIndex,
            dir,
        });
        if (newDropIndex !== -1) {
            dropIndex = newDropIndex;
        }
        if (this.dropIndex !== dropIndex) {
            this.getValidDropPositions(props, dragIndex, dropIndex);
            this.dragRowArrow.setValid(this.validDropPositions[dropIndex]);
        }
        this.dropIndex = dropIndex;
        if (computedGroupBy && computedGroupBy.length > 0) {
            this.getDropGroup();
        }
        const rowHeight = rowHeightManager.getRowHeight(this.dropIndex);
        this.dragRowArrow.setHeight(rowHeight);
        if (dragIndex !== this.dropIndex && dragIndex + 1 !== this.dropIndex) {
            const compareRanges = this.compareRanges({ scrollDiff });
            this.setReorderArrowAt(this.dropIndex, compareRanges);
        }
        else {
            this.setReorderArrowVisible(false);
        }
    };
    onRowDrop = (_event, _config, props) => {
        const { dropIndex } = this;
        const { onRowReorder, setActiveIndex, computedGroupBy } = props;
        if (dropIndex === undefined) {
            this.cancelDrop();
            this.clearDropInfo();
            return;
        }
        let { dragIndex } = DRAG_INFO;
        if (dropIndex === dragIndex || dropIndex === dragIndex + 1) {
            this.clearDropInfo();
            return;
        }
        if (!this.validDropPositions[dropIndex]) {
            this.clearDropInfo();
            return;
        }
        if (computedGroupBy && computedGroupBy.length > 0) {
            this.updateGroups(props, dragIndex, dropIndex);
            return;
        }
        this.clearDropInfo();
        setActiveIndex(dropIndex);
        if (onRowReorder && typeof onRowReorder === 'function') {
            this.onRowReorder(props, { dragIndex, dropIndex });
            return;
        }
        this.updateDataSource(props, { dropIndex, dragIndex });
    };
    updateDataSource = (props, { dropIndex, dragIndex }) => {
        const { data, setOriginalData } = props;
        if (this.validDropPositions[dropIndex]) {
            const newDataSource = moveXBeforeY(data, dragIndex, dropIndex);
            setOriginalData(newDataSource);
        }
    };
    updateGroups = (props, dragIndex, dropIndex) => {
        const { data, silentSetData, setItemOnReorderingGroups } = props;
        const { dropGroup, selectedGroup } = DRAG_INFO;
        if (!selectedGroup.localeCompare(dropGroup)) {
            const newDataSource = moveXBeforeY(data, dragIndex, dropIndex);
            silentSetData(newDataSource);
            this.clearDropInfo();
            return;
        }
        if (dropGroup) {
            const item = this.computeItem(props);
            setItemOnReorderingGroups(dragIndex, item, {
                replace: false,
            });
            const newDataSource = moveXBeforeY(data, dragIndex, dropIndex);
            silentSetData(newDataSource);
            this.clearDropInfo();
            return;
        }
        this.clearDropInfo();
        return;
    };
    computeItem = (props) => {
        const { computedGroupBy: groupBy } = props;
        const { dropKeyPath } = DRAG_INFO;
        if (!dropKeyPath) {
            return {};
        }
        let item = {};
        for (let i = 0; i < groupBy.length; i++) {
            item[groupBy[i]] = dropKeyPath[i];
        }
        return item;
    };
    initDrag = ({ cellNode }) => {
        const contentNode = this.content.getDOMNode();
        const headerNode = this.headerLayout
            ? this.headerLayout.headerDomNode.current
            : null;
        const contentRegion = Region.from(contentNode);
        const headerRegion = Region.from(headerNode);
        const headerHeight = headerRegion.getHeight();
        const node = cellNode && cellNode.current;
        const cellRegion = Region.from(node);
        return {
            contentRegion,
            headerHeight,
            cellRegion,
        };
    };
    getDropGroup = () => {
        const { ranges, dragBoxRegion } = DRAG_INFO;
        const { dropGroup, keyPath: dropKeyPath } = getDropGroup({
            ranges,
            dragBoxRegion,
        });
        DRAG_INFO = Object.assign({}, DRAG_INFO, {
            dropGroup,
            dropKeyPath,
        });
    };
    onRowReorder = (props, { dragIndex, dropIndex }) => {
        const { data, onRowReorder } = props;
        const rowData = data[dragIndex];
        onRowReorder({
            data: rowData,
            dragRowIndex: dragIndex,
            insertRowIndex: dropIndex,
        });
    };
    getDragProxy = (props, { dragIndex, contentRegion, cellRegion, dragBoxInitialRegion, }) => {
        const dragProxy = this.dragRow ? this.dragRow : undefined;
        dragProxy.setDragIndex(dragIndex);
        dragProxy.setProps(props);
        const dragBoxOffsets = {
            top: contentRegion.top,
            left: contentRegion.left,
        };
        const leftBoxOffset = cellRegion.left - dragBoxOffsets.left;
        this.dragRowArrow.setLeft(leftBoxOffset);
        const dragProxyPosition = {
            top: dragBoxInitialRegion.top - dragBoxOffsets.top,
            left: dragBoxInitialRegion.left - dragBoxOffsets.left,
        };
        return { dragProxy, dragProxyPosition, dragBoxOffsets, leftBoxOffset };
    };
    getDragBoxInitialRegion = ({ dragIndex }) => {
        const dragBox = this.getDragRowInstance(dragIndex);
        const dragBoxNode = dragBox.domRef ? dragBox.domRef.current : null;
        let dragBoxInitialRegion;
        if (dragBox) {
            dragBoxInitialRegion = Region.from(dragBoxNode);
        }
        this.dragBoxInitialHeight =
            dragBoxInitialRegion && dragBoxInitialRegion.getHeight();
        if (DRAG_ROW_MAX_HEIGHT &&
            dragBoxInitialRegion &&
            dragBoxInitialRegion.getHeight() > DRAG_ROW_MAX_HEIGHT) {
            dragBoxInitialRegion.setHeight(DRAG_ROW_MAX_HEIGHT);
            dragBoxInitialRegion.shift({
                top: this.dragBoxInitialHeight / 2 - DRAG_ROW_MAX_HEIGHT / 2,
            });
        }
        const dragRowHeight = dragBoxInitialRegion.getHeight();
        return { dragBoxInitialRegion, dragRowHeight };
    };
    setScrollRegionVisibility = () => {
        if (this.scrollTopRegionRef.current) {
            this.scrollTopRegionRef.current.setVisible(true);
            const height = this.headerLayout && this.headerLayout.headerNode.offsetHeight;
            this.scrollTopRegionRef.current.setHeight(height);
        }
        if (this.scrollBottomRegionRef.current) {
            this.scrollBottomRegionRef.current.setVisible(true);
        }
    };
    getRanges = (props, { initialScrollTop, contentRegion, dragBoxInitialRegion, }) => {
        const { count, rowHeightManager, data, computedGroupBy } = props;
        let ranges = [];
        let selectedGroup;
        if (computedGroupBy && computedGroupBy.length > 0) {
            ranges = getRangesForGroups({
                data,
                initialOffset: contentRegion.top,
                rowHeightManager,
                initialScrollTop,
            });
            const { dropGroup } = getDropGroup({
                ranges,
                dragBoxRegion: dragBoxInitialRegion,
            });
            selectedGroup = dropGroup;
        }
        else {
            ranges = getRangesForRows({
                count,
                initialOffset: contentRegion.top,
                rowHeightManager,
                initialScrollTop,
            });
        }
        return { ranges, selectedGroup };
    };
    compareRanges = ({ scrollDiff }) => {
        const { ranges } = DRAG_INFO;
        const mapRange = (r) => {
            if (!r) {
                return null;
            }
            if (r && r.group) {
                return null;
            }
            else {
                return {
                    ...r,
                    top: r.top - scrollDiff,
                    bottom: r.bottom - scrollDiff,
                };
            }
        };
        return ranges.map(mapRange);
    };
    ajustDragProxy = ({ diffTop, diffLeft, initialDiffTop, initialDiffLeft, dragProxyAjust, }) => {
        const { dragBoxRegion, dragBoxInitialRegion, dragBoxOffsets, headerHeight, leftBoxOffset, } = DRAG_INFO;
        dragBoxRegion.set({
            top: dragBoxInitialRegion.top,
            bottom: dragBoxInitialRegion.bottom,
            left: dragBoxInitialRegion.left,
            right: dragBoxInitialRegion.right,
        });
        dragBoxRegion.shift({
            top: diffTop,
            left: diffLeft,
        });
        const dragProxyTop = dragBoxInitialRegion.top -
            dragBoxOffsets.top +
            initialDiffTop -
            dragProxyAjust +
            headerHeight;
        const dragProxyLeft = dragBoxInitialRegion.left -
            dragBoxOffsets.left +
            initialDiffLeft +
            leftBoxOffset;
        return { dragProxyTop, dragProxyLeft };
    };
    getValidDropPositions = (props, dragIndex, dropIndex) => {
        const { computedGroupBy, data, count, isRowReorderValid, allowRowReoderBetweenGroups, } = props;
        const { selectedGroup } = DRAG_INFO;
        let validDropPositions;
        if (computedGroupBy && computedGroupBy.length > 0) {
            validDropPositions = dropGroupIndexValidation({
                data,
                dragIndex,
                dropIndex,
                isRowReorderValid,
                selectedGroup,
                allowRowReoderBetweenGroups,
            });
        }
        else {
            validDropPositions = dropIndexValidation({
                count,
                dragIndex,
                dropIndex,
                isRowReorderValid,
            });
        }
        this.validDropPositions = validDropPositions;
        return validDropPositions;
    };
    clearDropInfo = () => {
        global.clearInterval(this.gridScrollInterval);
        this.dragBoxInitialHeight = 0;
        this.setReorderArrowVisible(false);
        if (!DRAG_INFO) {
            return;
        }
        const { dragProxy } = DRAG_INFO;
        this.dropIndex = -1;
        dragProxy.setVisible(false);
        DRAG_INFO = null;
        if (this.scrollTopRegionRef.current) {
            this.scrollTopRegionRef.current.setVisible(false);
        }
        if (this.scrollBottomRegionRef.current) {
            this.scrollBottomRegionRef.current.setVisible(false);
        }
    };
    cancelDrop = () => {
        if (DRAG_INFO) {
            DRAG_INFO.dragProxy.setVisible(false);
        }
        this.setReorderArrowVisible(false);
        DRAG_INFO = null;
    };
    adjustScrollOnDrag = (props, config) => {
        const { rowReorderScrollByAmount } = props;
        const { contentRegion, scrollTopMax, dragBoxInitialRegion, initialScrollTop, } = DRAG_INFO;
        let diffTop = config.diff.top;
        let diffLeft = config.diff.left;
        const minScrollTop = Math.max(contentRegion.top, 0);
        const maxScrollTop = contentRegion.bottom;
        const scrollTop = this.getScrollTop();
        const scrollDiff = scrollTop - initialScrollTop;
        const initialDiffTop = diffTop;
        const initialDiffLeft = diffLeft;
        diffTop += scrollDiff;
        let scrollAjust = 0;
        let dragProxyAjust = 0;
        if (dragBoxInitialRegion.top + initialDiffTop <
            minScrollTop + SCROLL_MARGIN &&
            initialDiffTop < 0) {
            scrollAjust = -rowReorderScrollByAmount;
        }
        else if (dragBoxInitialRegion.top + initialDiffTop >
            maxScrollTop - SCROLL_MARGIN &&
            initialDiffTop > 0) {
            scrollAjust = rowReorderScrollByAmount;
        }
        if (scrollAjust) {
            if (scrollTop + scrollAjust < 0) {
                scrollAjust = -scrollTop;
            }
            if (scrollTop + scrollAjust > scrollTopMax) {
                scrollAjust = scrollTopMax - scrollTop;
            }
            if (scrollAjust) {
                if (!props.rowReorderAutoScroll) {
                    this.setScrollTop(scrollTop + scrollAjust);
                }
                dragProxyAjust = scrollAjust;
            }
        }
        return {
            initialDiffTop,
            initialDiffLeft,
            dragProxyAjust,
            scrollDiff,
            scrollTop,
            diffTop,
            diffLeft,
        };
    };
    setReorderArrowAt = (index, ranges, visible) => {
        visible = visible !== undefined ? visible : index !== DRAG_INFO.dragIndex;
        if (!scrolling) {
            this.setReorderArrowVisible(visible);
        }
        let box = ranges[index];
        if (!box) {
            return;
        }
        if (box.group) {
            return;
        }
        const { contentRegion } = DRAG_INFO;
        let boxPos;
        let dragRowArrowHeight = this.dragRowArrow.props
            .rowReorderArrowStyle
            ? this.dragRowArrow.props.rowReorderArrowStyle.height
            : 3;
        if (!Number.isInteger(dragRowArrowHeight)) {
            dragRowArrowHeight = 3;
        }
        if (index === 0) {
            boxPos = box.top;
        }
        else if (index === ranges.length) {
            boxPos = ranges[ranges.length - 1].bottom - dragRowArrowHeight;
        }
        else {
            boxPos = box.top - Math.floor(dragRowArrowHeight / 2);
        }
        const arrowPosition = boxPos - contentRegion.top;
        return this.setReorderArrowPosition(arrowPosition);
    };
    setReorderArrowPosition = (top) => {
        this.dragRowArrow.setTop(top);
    };
    setReorderArrowVisible = (visible) => {
        this.dragRowArrow.setVisible(visible);
    };
    onRowReorderValidation = (ev, props, dragIndex) => {
        if ((ev.isDefaultPrevented && ev.isDefaultPrevented()) ||
            ev.defaultPrevented) {
            return false;
        }
        const { onRowReorder, rowReorderColumn, computedPagination, computedSortInfo, computedFiltered, dataSource, data, computedPivot, } = props;
        if (!onRowReorder &&
            (typeof onRowReorder !== 'function' || typeof onRowReorder !== 'boolean')) {
            if (!rowReorderColumn) {
                return false;
            }
        }
        if ((ev.nativeEvent
            ? ev.nativeEvent.which === 3
            : ev.which === 3) /* right click */ ||
            ev.metaKey ||
            ev.ctrlKey) {
            return false;
        }
        if (computedPagination ||
            computedSortInfo ||
            computedFiltered ||
            typeof dataSource === 'function' ||
            (computedPivot && computedPivot.length > 0)) {
            if (typeof onRowReorder !== 'function') {
                return false;
            }
        }
        let dragRow;
        dragRow = data[dragIndex];
        if (!dragRow) {
            ev?.stopPropagation();
            return false;
        }
        return true;
    };
}
