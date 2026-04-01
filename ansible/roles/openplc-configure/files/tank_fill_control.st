PROGRAM tank_fill_control
  (* Tank Fill Control — Basic water tank level management
     Used in SCEN-001: SCADA Modbus Recon scenario.

     Registers:
       %IW0  = Tank level sensor (0-1000, mapped to 0-100%)
       %QW0  = Pump speed output (0-100%)
       %MW0  = Tank level setpoint (default: 750 = 75%)
       %MW1  = Alarm high threshold (default: 900 = 90%)
       %MW2  = Alarm low threshold (default: 200 = 20%)
       %QX0.0 = Pump enable/disable coil
       %QX0.1 = High level alarm output
       %QX0.2 = Low level alarm output
  *)

  VAR
    tank_level   AT %IW0   : INT;           (* Tank level sensor input *)
    pump_speed   AT %QW0   : INT;           (* Pump speed output *)
    setpoint     AT %MW0   : INT := 750;    (* Target level — holding register *)
    alarm_high   AT %MW1   : INT := 900;    (* High alarm threshold *)
    alarm_low    AT %MW2   : INT := 200;    (* Low alarm threshold *)
    pump_enable  AT %QX0.0 : BOOL := TRUE;  (* Pump master enable coil *)
    alarm_hi_out AT %QX0.1 : BOOL := FALSE; (* High alarm indicator *)
    alarm_lo_out AT %QX0.2 : BOOL := FALSE; (* Low alarm indicator *)
  END_VAR
  VAR
    error : INT := 0;                       (* Setpoint error *)
  END_VAR

  (* Simple proportional control *)
  error := setpoint - tank_level;

  IF pump_enable AND (tank_level < alarm_high) THEN
    IF error > 100 THEN
      pump_speed := 100;    (* Full speed when far below setpoint *)
    ELSIF error > 0 THEN
      pump_speed := error / 10 + 10;  (* Proportional when near setpoint *)
    ELSE
      pump_speed := 0;      (* Stop when at or above setpoint *)
    END_IF;
  ELSE
    pump_speed := 0;
  END_IF;

  (* Alarm logic *)
  alarm_hi_out := tank_level >= alarm_high;
  alarm_lo_out := tank_level <= alarm_low;

END_PROGRAM


CONFIGURATION Config0
  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#50ms, PRIORITY := 0);
    PROGRAM instance0 WITH task0 : tank_fill_control;
  END_RESOURCE
END_CONFIGURATION
