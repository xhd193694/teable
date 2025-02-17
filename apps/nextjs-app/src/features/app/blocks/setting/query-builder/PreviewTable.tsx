import { nullsToUndefinedShallow } from '@teable/core';
import { getRecords, type IGetRecordsRo } from '@teable/openapi';
import type { ICell, ICellItem } from '@teable/sdk/components';
import {
  CellType,
  DraggableType,
  Grid,
  SelectableType,
  useGridAsyncRecords,
  useGridColumns,
  useGridIcons,
  useGridTheme,
} from '@teable/sdk/components';
import { useIsHydrated, useTableId } from '@teable/sdk/hooks';
import { Table } from '@teable/sdk/model/table';
import { ToggleGroup, ToggleGroupItem } from '@teable/ui-lib/shadcn';
import { useTranslation } from 'next-i18next';
import { useCallback, useEffect, useState } from 'react';
import { developerConfig } from '@/features/i18n/developer.config';
import { CodeBlock } from './PreviewScript';

export const PreviewTable = ({ query }: { query: IGetRecordsRo }) => {
  const { t } = useTranslation(developerConfig.i18nNamespaces);
  const theme = useGridTheme();
  const { columns, cellValue2GridDisplay } = useGridColumns(false);

  const [rowCount, setRowCount] = useState<number>(0);
  const [recordRes, setRecordRes] = useState<unknown>(null);
  const tableId = useTableId();
  const [mode, setMode] = useState<string>('grid');

  useEffect(() => {
    if (tableId == null) return;

    Table.getRowCount(tableId, nullsToUndefinedShallow(query) as IGetRecordsRo).then((res) => {
      setRowCount(res.data.rowCount);
    });
  }, [tableId, query]);

  const isHydrated = useIsHydrated();

  const customIcons = useGridIcons();

  const { recordMap, onVisibleRegionChanged } = useGridAsyncRecords(undefined, query);

  useEffect(() => {
    if (mode === 'json' && tableId) {
      getRecords(tableId, { ...(nullsToUndefinedShallow(query) as IGetRecordsRo), take: 10 }).then(
        (res) => {
          setRecordRes(res.data);
        }
      );
    }
  }, [mode, query, tableId]);

  const getCellContent = useCallback<(cell: ICellItem) => ICell>(
    (cell) => {
      const [colIndex, rowIndex] = cell;
      const record = recordMap[rowIndex];
      if (record !== undefined) {
        const fieldId = columns[colIndex]?.id;
        if (!fieldId) return { type: CellType.Loading };
        return cellValue2GridDisplay(record, colIndex);
      }
      return { type: CellType.Loading };
    },
    [recordMap, columns, cellValue2GridDisplay]
  );

  return (
    <>
      <div className="flex">
        <ToggleGroup
          className="w-auto"
          type="single"
          variant="outline"
          size="sm"
          value={mode}
          onValueChange={(v) => setMode(v || 'grid')}
        >
          <ToggleGroupItem value="grid" aria-label="Toggle view">
            Grid
          </ToggleGroupItem>
          <ToggleGroupItem value="json" aria-label="Toggle json">
            JSON
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {mode === 'grid' && isHydrated && (
        <div className="relative h-[500px] w-full overflow-hidden rounded-lg border">
          <Grid
            style={{
              width: '100%',
              height: '100%',
            }}
            scrollBufferX={0}
            scrollBufferY={0}
            theme={theme}
            columns={columns}
            freezeColumnCount={0}
            rowCount={rowCount ?? 0}
            rowIndexVisible={false}
            customIcons={customIcons}
            draggable={DraggableType.None}
            selectable={SelectableType.None}
            isMultiSelectionEnable={false}
            onVisibleRegionChanged={onVisibleRegionChanged}
            getCellContent={getCellContent}
          />
        </div>
      )}
      {mode === 'json' && (
        <div>
          <p>{t('developer:only10Records')}</p>
          <CodeBlock code={JSON.stringify(recordRes, null, 2)} language="json" />
        </div>
      )}
    </>
  );
};
