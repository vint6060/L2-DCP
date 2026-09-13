# Синтетические примеры конфигураций

Файлы в этом каталоге полностью синтетические. Они не являются реальными дампами, не привязаны к конкретной сети и предназначены только для демонстрации и ручной проверки панели мониторинга. Имена устройств, номера портов, VLAN и адреса из документационных диапазонов выбраны как безопасные тестовые значения. В примерах нет реальных IP-адресов управления, паролей, SNMP community, серийных номеров или иных идентификаторов.

## Файлы

- `snr.cfg` — SNR: access/trunk, VLAN, MSTP, storm-control, port isolation, ACL и PoE.
- `dlink.cfg` — D-Link: tagged/untagged VLAN, PVID, MSTP, storm control, isolation, ACL-профиль и PoE.
- `fiberhome.cfg` — FiberHome: access/trunk, VLAN batch, MSTP, storm suppression, isolation, ACL и PoE.
- `edgecore.cfg` — Edgecore: access/trunk, VLAN database, MSTP, storm-control, protected port, ACL и PoE.
- `eltex.cfg` — Eltex: access/trunk, VLAN, MSTP, storm-control, port isolation, ACL и PoE.

## Ограничения

Парсер проекта эвристический и не является полноценным интерпретатором CLI. Он ищет знакомые ключевые слова и конструкции, поэтому результат зависит от модели, версии firmware, локализации и форматирования выгрузки. Одинаковые команды у разных линеек могут означать разные вещи, а часть вложенных секций, диапазонов и ACL-параметров может быть показана только как неизвестная директива. Синтаксис примеров правдоподобен для соответствующих вендоров, но не гарантирует возможность загрузки на физическое устройство.

Покрытые признаки: определение вендора, hostname, VLAN и имена VLAN, интерфейсы, access/trunk, access/native/PVID VLAN, состояние портов, STP/MSTP, storm-control или suppression, port isolation/protected port, ACL/access-list и PoE. Примеры не заменяют fixtures для конкретных моделей и версий firmware.
