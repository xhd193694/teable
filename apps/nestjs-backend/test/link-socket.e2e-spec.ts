/* eslint-disable @typescript-eslint/naming-convention */
/**
 * test case for simulate frontend collaboration data flow
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable sonarjs/no-duplicate-string */
import type { INestApplication } from '@nestjs/common';
import type { IFieldVo, IRecord, IRecordSnapshot } from '@teable-group/core';
import {
  generateTransactionKey,
  OpBuilder,
  IdPrefix,
  FieldType,
  Relationship,
} from '@teable-group/core';
import type { Doc } from '@teable/sharedb/lib/client';
import request from 'supertest';
import type { CreateFieldRo } from '../src/features/field/model/create-field.ro';
import type { LinkFieldDto } from '../src/features/field/model/field-dto/link-field.dto';
import { ShareDbService } from '../src/share-db/share-db.service';
import { initApp } from './utils/init-app';

describe('OpenAPI link (e2e)', () => {
  let app: INestApplication;
  let table1Id = '';
  let table2Id = '';
  let shareDbService!: ShareDbService;
  jest.useRealTimers();
  async function wait(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
  beforeAll(async () => {
    app = await initApp();
    shareDbService = app.get(ShareDbService);
  });

  afterAll(async () => {
    app.close();
  });

  afterEach(async () => {
    await request(app.getHttpServer()).delete(`/api/table/arbitrary/${table1Id}`);
    await request(app.getHttpServer()).delete(`/api/table/arbitrary/${table2Id}`);
  });

  describe('link field cell update', () => {
    let ctx: {
      numberFieldRo: CreateFieldRo;
      textFieldRo: CreateFieldRo;
      table1Records: IRecord[];
      table1Fields: IFieldVo[];
      table1linkField: LinkFieldDto;
      table2LinkFieldRo: CreateFieldRo;
      table2Id: string;
      table2Records: IRecord[];
      table2Fields: IFieldVo[];
    } = {} as any;
    beforeEach(async () => {
      const numberFieldRo: CreateFieldRo = {
        name: 'Number field',
        type: FieldType.Number,
        options: {
          precision: 1,
        },
      };

      const textFieldRo: CreateFieldRo = {
        name: 'text field',
        type: FieldType.SingleLineText,
      };

      const createTable1Result = await request(app.getHttpServer())
        .post('/api/table')
        .send({
          name: 'table1',
          fields: [textFieldRo, numberFieldRo],
          data: {
            records: [
              { fields: { 'text field': 'A1' } },
              { fields: { 'text field': 'A2' } },
              { fields: { 'text field': 'A3' } },
            ],
          },
        })
        .expect(201);

      table1Id = createTable1Result.body.data.id;
      const table1Records = createTable1Result.body.data.data.records;

      const table2LinkFieldRo: CreateFieldRo = {
        name: 'link field',
        type: FieldType.Link,
        options: {
          relationship: Relationship.ManyOne,
          foreignTableId: table1Id,
        },
      };

      // table2 link manyOne table1
      const createTable2Result = await request(app.getHttpServer())
        .post('/api/table')
        .send({
          name: 'table2',
          fields: [textFieldRo, numberFieldRo, table2LinkFieldRo],
          data: {
            records: [
              { fields: { 'text field': 'B1' } },
              { fields: { 'text field': 'B2' } },
              { fields: { 'text field': 'B3' } },
            ],
          },
        })
        .expect(201);
      table2Id = createTable2Result.body.data.id;

      const getFields1Result = await request(app.getHttpServer())
        .get(`/api/table/${table1Id}/field`)
        .expect(200);

      const table1linkField = getFields1Result.body.data[2];
      const table1Fields = getFields1Result.body.data;

      const table2Records = createTable2Result.body.data.data.records;
      const table2Fields = createTable2Result.body.data.fields;

      ctx = {
        numberFieldRo,
        textFieldRo,
        table2LinkFieldRo,
        table1linkField,
        table1Records,
        table1Fields,
        table2Id,
        table2Records,
        table2Fields,
      };
    });

    async function updateRecordViaShareDb(
      tableId: string,
      recordId: string,
      fieldId: string,
      newValues: any
    ) {
      const connection = shareDbService.connect();
      const collection = `${IdPrefix.Record}_${tableId}`;
      const data = await new Promise<IRecordSnapshot>((resolve, reject) => {
        const doc: Doc<IRecordSnapshot> = connection.get(collection, recordId);
        doc.fetch((err) => {
          if (err) {
            return reject(err);
          }
          const op = OpBuilder.editor.setRecord.build({
            fieldId,
            oldCellValue: doc.data.record.fields[fieldId],
            newCellValue: newValues,
          });

          doc.submitOp(op, { transactionKey: generateTransactionKey(), opCount: 1 }, (err) => {
            if (err) {
              return reject(err);
            }
            resolve(doc.data);
          });
        });
      });
      // wait for calculation
      await wait(100);
      return data;
    }

    it('should update foreign link field when set a new link in to link field cell', async () => {
      // t2[0](many) -> t1[1](one)
      await updateRecordViaShareDb(table2Id, ctx.table2Records[0].id, ctx.table2Fields[2].id, {
        title: 'test',
        id: ctx.table1Records[1].id,
      });

      const table2RecordResult = await request(app.getHttpServer())
        .get(`/api/table/${table2Id}/record`)
        .expect(200);

      expect(table2RecordResult.body.data.records[0].fields[ctx.table2Fields[2].name]).toEqual({
        title: 'A2',
        id: ctx.table1Records[1].id,
      });
      const table1RecordResult2 = await request(app.getHttpServer())
        .get(`/api/table/${table1Id}/record`)
        .expect(200);

      // t1[0](one) should be undefined;
      expect(table1RecordResult2.body.data.records[1].fields[ctx.table1linkField.name]).toEqual([
        {
          title: 'B1',
          id: ctx.table2Records[0].id,
        },
      ]);
      expect(
        table1RecordResult2.body.data.records[0].fields[ctx.table1linkField.name]
      ).toBeUndefined();
    });

    it('should update foreign link field when change lookupField value', async () => {
      // set text for lookup field
      await updateRecordViaShareDb(table2Id, ctx.table2Records[0].id, ctx.table2Fields[0].id, 'B1');
      await updateRecordViaShareDb(table2Id, ctx.table2Records[1].id, ctx.table2Fields[0].id, 'B2');

      // add an extra link for table1 record1
      await updateRecordViaShareDb(table2Id, ctx.table2Records[0].id, ctx.table2Fields[2].id, {
        title: 'A1',
        id: ctx.table1Records[0].id,
      });
      await updateRecordViaShareDb(table2Id, ctx.table2Records[1].id, ctx.table2Fields[2].id, {
        title: 'A1',
        id: ctx.table1Records[0].id,
      });

      const table1RecordResult2 = await request(app.getHttpServer())
        .get(`/api/table/${table1Id}/record`)
        .expect(200);

      expect(table1RecordResult2.body.data.records[0].fields[ctx.table1linkField.name]).toEqual([
        {
          title: 'B1',
          id: ctx.table2Records[0].id,
        },
        {
          title: 'B2',
          id: ctx.table2Records[1].id,
        },
      ]);

      await updateRecordViaShareDb(table1Id, ctx.table1Records[0].id, ctx.table1Fields[0].id, 'AX');

      const table2RecordResult2 = await request(app.getHttpServer())
        .get(`/api/table/${table2Id}/record`)
        .expect(200);

      expect(table2RecordResult2.body.data.records[0].fields[ctx.table2LinkFieldRo.name]).toEqual({
        title: 'AX',
        id: ctx.table1Records[0].id,
      });
    });

    it('should update self foreign link with correct title', async () => {
      // set text for lookup field

      await updateRecordViaShareDb(table2Id, ctx.table2Records[0].id, ctx.table2Fields[0].id, 'B1');
      await updateRecordViaShareDb(table2Id, ctx.table2Records[1].id, ctx.table2Fields[0].id, 'B2');
      await updateRecordViaShareDb(table1Id, ctx.table1Records[0].id, ctx.table1linkField.id, [
        { title: 'B1', id: ctx.table2Records[0].id },
        { title: 'B2', id: ctx.table2Records[1].id },
      ]);

      const table1RecordResult2 = await request(app.getHttpServer())
        .get(`/api/table/${table1Id}/record`)
        .expect(200);

      expect(table1RecordResult2.body.data.records[0].fields[ctx.table1linkField.name]).toEqual([
        {
          title: 'B1',
          id: ctx.table2Records[0].id,
        },
        {
          title: 'B2',
          id: ctx.table2Records[1].id,
        },
      ]);
    });

    it('should update formula field when change manyOne link cell', async () => {
      const table2FormulaFieldRo: CreateFieldRo = {
        name: 'table2Formula',
        type: FieldType.Formula,
        options: {
          expression: `{${ctx.table2Fields[2].id}}`,
        },
      };

      await request(app.getHttpServer())
        .post(`/api/table/${table2Id}/field`)
        .send(table2FormulaFieldRo as CreateFieldRo)
        .expect(201);

      await updateRecordViaShareDb(table2Id, ctx.table2Records[0].id, ctx.table2Fields[2].id, {
        title: 'test1',
        id: ctx.table1Records[1].id,
      });

      const table1RecordResult = await request(app.getHttpServer())
        .get(`/api/table/${table1Id}/record`)
        .expect(200);

      const table2RecordResult = await request(app.getHttpServer())
        .get(`/api/table/${table2Id}/record`)
        .expect(200);

      expect(
        table1RecordResult.body.data.records[0].fields[ctx.table1linkField.name]
      ).toBeUndefined();

      expect(table1RecordResult.body.data.records[1].fields[ctx.table1linkField.name]).toEqual([
        {
          title: 'B1',
          id: ctx.table2Records[0].id,
        },
      ]);

      expect(table2RecordResult.body.data.records[0].fields[table2FormulaFieldRo.name]).toEqual(
        'A2'
      );
    });

    it('should update formula field when change oneMany link cell', async () => {
      const table1FormulaFieldRo: CreateFieldRo = {
        name: 'table1 formula field',
        type: FieldType.Formula,
        options: {
          expression: `{${ctx.table1linkField.id}}`,
        },
      };

      await request(app.getHttpServer())
        .post(`/api/table/${table1Id}/field`)
        .send(table1FormulaFieldRo as CreateFieldRo)
        .expect(201);

      await updateRecordViaShareDb(table1Id, ctx.table1Records[0].id, ctx.table1linkField.id, [
        { title: 'test1', id: ctx.table2Records[0].id },
        { title: 'test2', id: ctx.table2Records[1].id },
      ]);

      const table1RecordResult = await request(app.getHttpServer())
        .get(`/api/table/${table1Id}/record`)
        .expect(200);

      expect(table1RecordResult.body.data.records[0].fields[ctx.table1linkField.name]).toEqual([
        { title: 'B1', id: ctx.table2Records[0].id },
        { title: 'B2', id: ctx.table2Records[1].id },
      ]);

      expect(table1RecordResult.body.data.records[0].fields[table1FormulaFieldRo.name]).toEqual(
        'B1, B2'
      );
    });

    it('should update oneMany formula field when change oneMany link cell', async () => {
      const table1FormulaFieldRo: CreateFieldRo = {
        name: 'table1 formula field',
        type: FieldType.Formula,
        options: {
          expression: `{${ctx.table1linkField.id}}`,
        },
      };
      await request(app.getHttpServer())
        .post(`/api/table/${table1Id}/field`)
        .send(table1FormulaFieldRo as CreateFieldRo)
        .expect(201);

      const table2FormulaFieldRo: CreateFieldRo = {
        name: 'table2 formula field',
        type: FieldType.Formula,
        options: {
          expression: `{${ctx.table2Fields[2].id}}`,
        },
      };
      await request(app.getHttpServer())
        .post(`/api/table/${table2Id}/field`)
        .send(table2FormulaFieldRo as CreateFieldRo)
        .expect(201);

      await updateRecordViaShareDb(table2Id, ctx.table2Records[0].id, ctx.table2Fields[2].id, {
        title: 'A1',
        id: ctx.table1Records[0].id,
      });

      await updateRecordViaShareDb(table2Id, ctx.table2Records[1].id, ctx.table2Fields[2].id, {
        title: 'A2',
        id: ctx.table1Records[1].id,
      });

      console.log('-------------------hr------------------');
      // table2 record2 link from A2 to A1
      await updateRecordViaShareDb(table2Id, ctx.table2Records[1].id, ctx.table2Fields[2].id, {
        title: 'A1',
        id: ctx.table1Records[0].id,
      });

      const table1RecordResult = (
        await request(app.getHttpServer()).get(`/api/table/${table1Id}/record`).expect(200)
      ).body.data.records;
      const table2RecordResult = (
        await request(app.getHttpServer()).get(`/api/table/${table2Id}/record`).expect(200)
      ).body.data.records;

      expect(table1RecordResult[0].fields[table1FormulaFieldRo.name]).toEqual('B1, B2');
      expect(table1RecordResult[1].fields[table1FormulaFieldRo.name]).toEqual('');
      expect(table2RecordResult[0].fields[table2FormulaFieldRo.name]).toEqual('A1');
      expect(table2RecordResult[1].fields[table2FormulaFieldRo.name]).toEqual('A1');
    });
  });
});