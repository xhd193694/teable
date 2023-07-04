import { z } from 'zod';
import { FieldType, DbFieldType, CellValueType } from '../constant';
import { FieldCore } from '../field';

export type IAttachmentItem = {
  id: string;
  name: string;
  token: string;
  size: number;
  mimetype: string;
  path: string;
  width?: number;
  height?: number;
};

export type IAttachmentCellValue = IAttachmentItem[];

export class AttachmentFieldCore extends FieldCore {
  type: FieldType.Attachment = FieldType.Attachment;

  dbFieldType = DbFieldType.Text;

  options = null;

  defaultValue = null;

  cellValueType = CellValueType.String;

  isMultipleCellValue = true;

  isComputed = false;

  cellValue2String(cellValue?: IAttachmentCellValue) {
    return cellValue ? cellValue.map((cv) => cv.name).join(',') : '';
  }

  convertStringToCellValue(_value: string) {
    return null;
  }

  repair(value: unknown) {
    return value;
  }

  validateOptions() {
    return z.undefined().nullable().safeParse(this.options);
  }

  validateDefaultValue() {
    return z.undefined().nullable().safeParse(this.defaultValue);
  }
}