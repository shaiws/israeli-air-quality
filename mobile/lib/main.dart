import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';

/// Snapshot published by the companion GitHub Pages site (avoids MoEP CORS proxy).
const snapshotUrl =
    'https://shaiws.github.io/israeli-air-quality/data/latest.json';
const forecastCkan =
    'https://data.gov.il/api/3/action/datastore_search?resource_id=a976089d-e8e5-4013-8f3d-777b8551c684&limit=50';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AirQualityApp());
}

class AirQualityApp extends StatelessWidget {
  const AirQualityApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'איכות אוויר בישראל',
      debugShowCheckedModeBanner: false,
      locale: const Locale('he'),
      supportedLocales: const [Locale('he'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0284C7),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      builder: (context, child) => Directionality(
        textDirection: ui.TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const AirHomePage(),
    );
  }
}

bool isValidValue(num? n) => n != null && n.isFinite && n > -9000;

String pollutantLabel(String name) {
  const map = {
    'PM2.5': 'PM2.5',
    'PM25': 'PM2.5',
    'PM10': 'PM10',
    'NO2': 'NO₂',
    'O3': 'O₃',
    'SO2': 'SO₂',
    'CO': 'CO',
    'Benzene': 'בנזן',
  };
  return map[name] ?? name;
}

String formatDateTime(String? iso) {
  if (iso == null || iso.isEmpty) return '—';
  try {
    final d = DateTime.parse(iso).toLocal();
    return DateFormat('dd/MM/yyyy HH:mm', 'he').format(d);
  } catch (_) {
    return iso;
  }
}

Color? parseColor(String? hex) {
  if (hex == null || hex.isEmpty || hex.toLowerCase() == 'gray') {
    return const Color(0xFF94A3B8);
  }
  var h = hex.replaceAll('#', '');
  if (h.length == 6) h = 'FF$h';
  if (h.length != 8) return const Color(0xFF94A3B8);
  return Color(int.parse(h, radix: 16));
}

class StationView {
  final int stationId;
  final String name;
  final String regionName;
  final bool active;
  final int? index;
  final String? description;
  final String? color;
  final String? pollutant;
  final String? datetime;
  final List<Map<String, dynamic>> channels;

  StationView({
    required this.stationId,
    required this.name,
    required this.regionName,
    required this.active,
    this.index,
    this.description,
    this.color,
    this.pollutant,
    this.datetime,
    required this.channels,
  });
}

class AirSnapshotData {
  final String fetchedAt;
  final List<StationView> stations;
  final List<Map<String, dynamic>> forecast;

  AirSnapshotData({
    required this.fetchedAt,
    required this.stations,
    required this.forecast,
  });
}

Future<AirSnapshotData> loadSnapshot() async {
  final res = await http.get(
    Uri.parse(snapshotUrl),
    headers: {'Accept': 'application/json', 'Cache-Control': 'no-cache'},
  );
  if (res.statusCode != 200) {
    throw Exception('טעינת צילום נתונים נכשלה (${res.statusCode})');
  }
  final json = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
  final stationsRaw = (json['stations'] as List?) ?? [];
  final indexRaw = (json['index'] as List?) ?? [];
  final readingsRaw = (json['readings'] as List?) ?? [];

  final byIndex = {
    for (final i in indexRaw)
      (i as Map)['stationId'] as int: Map<String, dynamic>.from(i),
  };
  final byReading = {
    for (final r in readingsRaw)
      (r as Map)['stationId'] as int: Map<String, dynamic>.from(r),
  };

  final stations = <StationView>[];
  for (final s in stationsRaw) {
    final m = Map<String, dynamic>.from(s as Map);
    final id = m['stationId'] as int;
    final aqi = byIndex[id];
    final reading = byReading[id];
    final channels = <Map<String, dynamic>>[];
    final regionData = reading?['regionData'] as Map<String, dynamic>?;
    for (final c in (regionData?['channels'] as List?) ?? []) {
      final ch = Map<String, dynamic>.from(c as Map);
      final v = ch['value'];
      if (v is num && isValidValue(v)) {
        channels.add(ch);
      } else {
        ch['value'] = null;
        channels.add(ch);
      }
    }
    stations.add(StationView(
      stationId: id,
      name: '${m['name'] ?? ''}',
      regionName: '${m['regionName'] ?? ''}',
      active: m['active'] == true,
      index: (aqi?['index'] as num?)?.toInt(),
      description: aqi?['description']?.toString(),
      color: aqi?['color']?.toString(),
      pollutant: aqi?['pollutant']?.toString(),
      datetime: aqi?['datetime']?.toString() ?? regionData?['datetime']?.toString(),
      channels: channels,
    ));
  }
  stations.sort((a, b) => a.name.compareTo(b.name));

  var forecast = ((json['forecast'] as List?) ?? [])
      .map((e) => Map<String, dynamic>.from(e as Map))
      .toList();
  if (forecast.isEmpty) {
    try {
      final fres = await http.get(Uri.parse(forecastCkan));
      if (fres.statusCode == 200) {
        final fjson = jsonDecode(utf8.decode(fres.bodyBytes)) as Map<String, dynamic>;
        forecast = ((fjson['result']?['records'] as List?) ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      }
    } catch (_) {}
  }

  return AirSnapshotData(
    fetchedAt: '${json['fetchedAt'] ?? ''}',
    stations: stations,
    forecast: forecast,
  );
}

class AirHomePage extends StatefulWidget {
  const AirHomePage({super.key});

  @override
  State<AirHomePage> createState() => _AirHomePageState();
}

class _AirHomePageState extends State<AirHomePage> {
  AirSnapshotData? _data;
  String? _error;
  bool _loading = true;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await loadSnapshot();
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final stations = (_data?.stations ?? [])
        .where((s) =>
            _query.trim().isEmpty ||
            s.name.contains(_query.trim()) ||
            s.regionName.contains(_query.trim()))
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('איכות אוויר בישראל'),
        backgroundColor: cs.primaryContainer,
        actions: [
          IconButton(onPressed: _loading ? null : _reload, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!),
                        const SizedBox(height: 12),
                        FilledButton(onPressed: _reload, child: const Text('נסה שוב')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _reload,
                  child: ListView(
                    padding: const EdgeInsets.all(12),
                    children: [
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Text(
                            'נתונים מצילום פתוח (GitHub Pages) + תחזית data.gov.il. '
                            'עודכן: ${formatDateTime(_data?.fetchedAt)}',
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (_data!.forecast.isNotEmpty) ...[
                        Text('תחזית', style: Theme.of(context).textTheme.titleMedium),
                        for (final f in _data!.forecast.take(5))
                          Card(
                            child: ListTile(
                              title: Text('${f['title'] ?? f['name'] ?? 'תחזית'}'),
                              subtitle: Text(
                                [
                                  if (f['date'] != null) '${f['date']}',
                                  if (f['air_quality'] != null) '${f['air_quality']}',
                                  if (f['content'] != null) '${f['content']}',
                                ].where((s) => s.isNotEmpty).join(' · '),
                              ),
                            ),
                          ),
                        const SizedBox(height: 8),
                      ],
                      TextField(
                        decoration: const InputDecoration(
                          labelText: 'סינון תחנה / אזור',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.search),
                        ),
                        onChanged: (v) => setState(() => _query = v),
                      ),
                      const SizedBox(height: 8),
                      Text('${stations.length} תחנות'),
                      for (final s in stations)
                        Card(
                          color: parseColor(s.color)?.withValues(alpha: 0.35),
                          child: ListTile(
                            title: Text(s.name),
                            subtitle: Text(
                              [
                                s.regionName,
                                if (s.description != null) s.description!,
                                if (s.pollutant != null)
                                  pollutantLabel(s.pollutant!),
                                if (s.datetime != null)
                                  formatDateTime(s.datetime),
                              ].where((e) => e.isNotEmpty).join(' · '),
                            ),
                            trailing: s.index != null
                                ? Text(
                                    '${s.index}',
                                    style: Theme.of(context).textTheme.titleLarge,
                                  )
                                : null,
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => StationDetailPage(station: s),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
    );
  }
}

class StationDetailPage extends StatelessWidget {
  final StationView station;
  const StationDetailPage({super.key, required this.station});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(station.name)),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          Card(
            color: parseColor(station.color)?.withValues(alpha: 0.4),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(station.regionName),
                  Text(
                    station.description ?? 'אין מדד',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  if (station.index != null) Text('מדד: ${station.index}'),
                  if (station.pollutant != null)
                    Text('מזהם מוביל: ${pollutantLabel(station.pollutant!)}'),
                  Text('זמן: ${formatDateTime(station.datetime)}'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text('ערוצים', style: Theme.of(context).textTheme.titleMedium),
          for (final c in station.channels)
            ListTile(
              title: Text(pollutantLabel('${c['name'] ?? c['alias'] ?? ''}')),
              subtitle: Text('${c['units'] ?? ''}'),
              trailing: Text(
                c['value'] == null ? '—' : '${c['value']}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
        ],
      ),
    );
  }
}
