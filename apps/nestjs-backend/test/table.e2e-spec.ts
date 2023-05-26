/* eslint-disable @typescript-eslint/naming-convention */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { initApp } from './init-app';

const defaultData = {
  name: 'Project Management',
  description: 'A table for managing projects',
  fields: [
    {
      name: 'Project Name',
      description: 'The name of the project',
      type: 'singleLineText',
      notNull: true,
      unique: true,
    },
    {
      name: 'Project Description',
      description: 'A brief description of the project',
      type: 'longText',
    },
    {
      name: 'Project Status',
      description: 'The current status of the project',
      type: 'singleSelect',
      options: {
        choices: [
          {
            name: 'Not Started',
            color: 'gray',
          },
          {
            name: 'In Progress',
            color: 'blue',
          },
          {
            name: 'Completed',
            color: 'green',
          },
        ],
      },
    },
    {
      name: 'Project Manager',
      description: 'The person responsible for managing the project',
      type: 'user',
    },
    {
      name: 'Start Date',
      description: 'The date the project started',
      type: 'date',
    },
    {
      name: 'End Date',
      description: 'The date the project is expected to end',
      type: 'date',
    },
  ],
  views: [
    {
      name: 'Grid View',
      description: 'A grid view of all projects',
      type: 'grid',
      options: {
        rowHeight: 'short',
      },
    },
    {
      name: 'Kanban View',
      description: 'A kanban view of all projects',
      type: 'kanban',
      options: {
        groupingFieldId: 'Project Status',
      },
    },
  ],
  rows: {
    records: [
      {
        fields: {
          'Project Name': 'Project A',
          'Project Description': 'A project to develop a new product',
          'Project Status': 'Not Started',
          'Project Manager': 'John Doe',
          'Start Date': '2022-01-01',
          'End Date': '2022-06-30',
        },
      },
      {
        fields: {
          'Project Name': 'Project B',
          'Project Description': 'A project to improve customer service',
          'Project Status': 'In Progress',
          'Project Manager': 'Jane Smith',
          'Start Date': '2022-02-01',
          'End Date': '2022-08-31',
        },
      },
    ],
  },
};

describe('OpenAPI FieldController (e2e)', () => {
  let app: INestApplication;
  let tableId = '';

  beforeAll(async () => {
    app = await initApp();
  });

  afterAll(async () => {
    const result = await request(app.getHttpServer()).delete(`/api/table/arbitrary/${tableId}`);
    console.log('clear table: ', result.body);
  });

  it('/api/table/ (POST) with defualt data', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/table')
      .send(defaultData)
      .expect(201);
    expect(result.body).toMatchObject({
      success: true,
    });

    tableId = result.body.data.id;
    const recordResult = await request(app.getHttpServer())
      .get(`/api/table/${tableId}/record`)
      .expect(200);
    expect(recordResult.body.data.records).toHaveLength(2);
  });

  it('/api/table/ (POST) empty', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/table')
      .send({ name: 'new table' })
      .expect(201);
    expect(result.body).toMatchObject({
      success: true,
    });
    tableId = result.body.data.id;
    const recordResult = await request(app.getHttpServer())
      .get(`/api/table/${tableId}/record`)
      .expect(200);
    expect(recordResult.body.data.records).toHaveLength(3);
  });
});