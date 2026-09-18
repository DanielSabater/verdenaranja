# Mejoras y Refactorizaciones Pendientes

*(No hay pendientes críticas actualmente)*

---

### Tareas Completadas Recientes

- [x] **Corrección del Efecto Rebote y Optimización de Autoguardado (Supabase)**:
  - Archivo: [`src/hooks/usePersistentState.js`](file:///Users/danielsabater/Desktop/Diario/VERDE%20NARANJA/verdenaranja/src/hooks/usePersistentState.js)
  - Se eliminó el `isInitial` y el `setTimeout` de 1000ms al cargar.
  - Se agregó `latestStateRef` para proteger `dirtyKeys` de borrados a ciegas si el usuario hace ediciones adicionales mientras viaja una petición de guardado.
  - Se redujo el debounce de guardado de 1000ms a 400ms.
  - Verificado en pruebas automatizadas multi-dispositivo con 0 rebotes.
