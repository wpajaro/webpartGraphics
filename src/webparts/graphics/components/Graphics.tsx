import * as React from 'react';
import {
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  SelectionMode,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  Text,
  ITextStyles,
  Pivot,
  PivotItem,
} from '@fluentui/react';
import { SPHttpClient } from '@microsoft/sp-http';
import styles from './Graphics.module.scss';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend
);

interface IGraphicsProps {
  context: WebPartContext;
}

const titleStyles: ITextStyles = {
  root: {
    marginBottom: 20,
    fontWeight: 'semibold',
  },
};

const convertirDuracionAMinutos = (texto: string): number => {
  const match = texto.match(/(\d+)h\s*(\d+)min/);
  if (!match) return 0;
  const horas = parseInt(match[1], 10);
  const minutos = parseInt(match[2], 10);
  return horas * 60 + minutos;
};


const Graphics: React.FC<IGraphicsProps> = ({ context }) => {
  const camposAMostrar = ['ID', 'placa', 'marca', 'propietario', 'hora_entrada', 'hora_salida', 'duracion'];
  const [items, setItems] = React.useState<any[]>([]);
  const [columns, setColumns] = React.useState<IColumn[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedTab, setSelectedTab] = React.useState<string>('tabla');

  const chartRef = React.useRef<HTMLCanvasElement>(null);
  const lineChartRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const fetchListData = async () => {
      try {
        const webUrl = context.pageContext.web.absoluteUrl;
        const listTitle = 'tabla_v_prueba';

        const fieldsResponse = await context.spHttpClient.get(
          `${webUrl}/_api/web/lists/getbytitle('${listTitle}')/fields?$select=Title,InternalName&$filter=(${camposAMostrar.map(f => `InternalName eq '${f}'`).join(' or ')})`,
          SPHttpClient.configurations.v1
        );

        const itemsResponse = await context.spHttpClient.get(
          `${webUrl}/_api/web/lists/getbytitle('${listTitle}')/items?$select=${camposAMostrar.join(',')}&$top=1000`,
          SPHttpClient.configurations.v1
        );

        if (!fieldsResponse.ok || !itemsResponse.ok) {
          throw new Error('Error al obtener datos de la lista');
        }

        const fields = (await fieldsResponse.json()).value;
        const items = (await itemsResponse.json()).value;

        const generatedColumns: IColumn[] = fields.map((field: any) => ({
          key: field.InternalName,
          name: field.Title,
          fieldName: field.InternalName,
          minWidth: 100,
          maxWidth: 200,
          isResizable: true,
        }));

        setColumns(generatedColumns);
        setItems(items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchListData();
  }, [context]);

  React.useEffect(() => {
    if (selectedTab !== 'graficas' || !items.length || !chartRef.current || !lineChartRef.current) return;

    // GRÁFICA DE BARRAS POR MARCA
    const marcasCount = items.reduce((acc, item) => {
      const marca = item.marca || 'Sin marca';
      acc[marca] = (acc[marca] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const barChart = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels: Object.keys(marcasCount),
        datasets: [{
          label: 'Vehículos por marca',
          data: Object.values(marcasCount),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });

    // GRÁFICA LINEAL DE DURACIÓN
    const placas = items.map(item => item.placa || 'Sin placa');
    const duraciones = items.map(item => convertirDuracionAMinutos(item.duracion));


    const lineChart = new Chart(lineChartRef.current, {
      type: 'line',
      data: {
        labels: placas,
        datasets: [{
          label: 'Duración (minutos)',
          data: duraciones,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Minutos',
            },
          },
          x: {
            title: {
              display: true,
              text: 'Vehículos (placas)',
            },
          },
        },
      },
    });

    return () => {
      barChart.destroy();
      lineChart.destroy();
    };
  }, [selectedTab, items]);

  if (loading) {
    return <Spinner label="Cargando datos..." size={SpinnerSize.large} />;
  }

  if (error) {
    return (
      <MessageBar messageBarType={MessageBarType.error}>
        {error}
      </MessageBar>
    );
  }

  return (
    <div className={styles.container}>
      <Text variant="xLarge" block styles={titleStyles}>
        Registros de Vehículos ({items.length})
      </Text>

      <Pivot selectedKey={selectedTab} onLinkClick={item => setSelectedTab(item?.props.itemKey || '')}>
        <PivotItem headerText="Tabla" itemKey="tabla">
          <DetailsList
            items={items}
            columns={columns}
            selectionMode={SelectionMode.none}
            layoutMode={DetailsListLayoutMode.justified}
          />
        </PivotItem>

        <PivotItem headerText="Gráficas" itemKey="graficas">
          <div style={{ marginTop: 20 }}>
            <Text variant="large">Vehículos por marca</Text>
            <canvas ref={chartRef} width="400" height="200"></canvas>
          </div>

          <div style={{ marginTop: 40 }}>
            <Text variant="large">Duración por vehículo</Text>
            <canvas ref={lineChartRef} width="400" height="200"></canvas>
          </div>
        </PivotItem>
      </Pivot>
    </div>
  );
};

export default Graphics;
