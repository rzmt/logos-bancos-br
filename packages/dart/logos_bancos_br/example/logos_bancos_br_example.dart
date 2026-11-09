import 'dart:convert';
import 'dart:io';

import 'package:logos_bancos_br/logos_bancos_br.dart';

Future<void> main() async {
  // When you know the ISPB of the asset file, build the URL directly.
  // Itaú Unibanco (ISPB 60701190):
  print(logoPngUrl('60701190')); // 256x256 PNG
  print(logoSvgUrl('60701190'));

  // Cooperatives use their system's logo, stored under another ISPB. When
  // you only know the institution's own ISPB, look it up in the pre-resolved
  // {ISPB: url} map (SVG when available, PNG otherwise).
  final client = HttpClient();
  try {
    final request = await client.getUrl(Uri.parse(logoUrlsJsonUrl));
    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();
    final logoUrls = jsonDecode(body) as Map<String, dynamic>;

    // Sicoob Paulista (ISPB 10262276) resolves to the Sicoob file.
    // Institutions without a logo yet are absent from the map (null).
    print(logoUrls['10262276']); // …/logos/svg/04891850.svg
  } finally {
    client.close();
  }
}
