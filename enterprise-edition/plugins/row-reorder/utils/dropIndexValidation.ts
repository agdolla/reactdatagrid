/**
 * Copyright © INOVUA TRADING.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const dropIndexValidation = ({
  count,
  dragIndex,
  dropIndex,
  isRowReorderValid,
}: {
  count: number;
  dragIndex: number;
  dropIndex: number;
  isRowReorderValid: Function;
}) => {
  let validDropPositions = [...Array(count)].reduce((acc, _curr, i) => {
    acc[i] = true;

    return acc;
  }, {});
  validDropPositions[count] = true;

  if (isRowReorderValid) {
    validDropPositions[dropIndex] = isRowReorderValid({
      dragRowIndex: dragIndex,
      dropRowIndex: dropIndex,
    });
  }

  return validDropPositions;
};

export default dropIndexValidation;
