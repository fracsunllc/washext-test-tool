// ## Serial read sub-routines. 

void processSerial() {
    bool stay_in_menu = false;
    recvOneChar();
    showNewData();
    delay(100);
    switch (receivedChar) {
        case 'm': {
            modbus_thread_go = false;
            LEDstandby.setActive();
            stay_in_menu = true;
            for (int i = 0; serial_menu_modbus[i] != NULL; i++) {
                Log(serial_menu_modbus[i]);
            }
            while (stay_in_menu) {
                waitFor(Serial.available, 120000);
                recvOneChar();
                showNewData();
                switch (receivedChar) {
                    case '1': {
                        print_modbus_settings();
                        break;
                    }
                    case '2': {
                        if (!eepromValues.modbus_slave_mode) {
                            Log(">> Are you sure you want to turn on Slave mode? ARES and the Wash Extension will no longer communicate directly. ");
                            Log("The Wash Extension must be controlled by the new Modbus master.");
                            Log(">> Press 'y' to accept: ");
                            waitFor(Serial.available, 120000);
                            recvOneChar();
                            if (receivedChar == 'y') {
                                eepromValues.modbus_slave_mode = true;
                                saveEEPROM();
                                Log(" ");
                                Log(">> Modbus Slave mode ON"); 
                                Log(">> Resetting the System now. If other changes are necessary, revisit this menu upon reset.");
                                delay(2000);
                                System.reset(); 
                            }
                            else {
                                Log(">> Canceled");
                            }
                        }
                        else {
                            Log(">> Slave mode is already ON. Doing nothing. Back to Main Menu.");
                        }
                        break;
                    }
                    case '3': {
                        if (eepromValues.modbus_slave_mode) {
                            Log(">> Are you sure you want to turn off Slave mode? This device will become a Modbus Master. ");
                            Log("It may cause interference on the existing Modbus network if connected to other devices.");
                            Log(">> Press 'y' to accept: ");
                            waitFor(Serial.available, 120000);
                            recvOneChar();
                            if (receivedChar == 'y') {
                                eepromValues.modbus_slave_mode = false;
                                saveEEPROM();
                                Log(" ");
                                Log(">> Modbus Slave mode OFF (Master mode ON)"); 
                                Log(">> Resetting the System now. If other changes are necessary, revisit this menu upon reset.");
                                delay(2000);
                                System.reset(); 
                            }
                            else {
                                Log(">> Canceled");
                            }
                        }
                        else {
                            Log(">> Slave mode is already OFF. Doing nothing. Back to Main Menu.");
                        }
                        break;
                    }
                    case '4': {
                        Log(">> Enter the new slave address (1-255): ");
                        while (!newData) {
                            waitFor(Serial.available, 120000);
                            recvWithEndMarker();
                        }
                        showNewNumber();
                        Log(" ");
                        if (1 <= num && num <= 255) {
                            eepromValues.modbus_slaveAddr = num;
                            saveEEPROM();
                            Log(">> New slave address saved: %d", eepromValues.modbus_slaveAddr);
                        }
                        else {
                            Log(">> Invalid slave address: %d . Back to Main Menu", num);
                        }
                        break;
                    }
                    case '5': {
                        Log(">> Enter the new baud rate (4800, 9600, 19200, 38400): ");
                        while (!newData) {
                            waitFor(Serial.available, 120000);
                            recvWithEndMarker();
                        }
                        showNewNumber();
                        Log(" ");
                        if (num == 4800 || num == 9600 || num == 19200 || num == 38400) {
                            eepromValues.modbus_baud = num;
                            saveEEPROM();
                            Log(">> New baud rate saved: %lu", eepromValues.modbus_baud);
                        }
                        else {
                            Log("Not a valid baud rate: %d. Back to Main Menu.", num);
                        }
                        break;
                    }
                    case '6': {
                        Log(">> Enter a serial configuration code from the lookup table (type 0 or 4): ");
                        Log("  Code | Databits | Parity | Stop Bits");
                        Log("  [0]  |     8    |  None  |     1    ");
                        Log("  [4]  |     8    |  Even  |     1     (default / standard)");
                        Log(">>: ");
                        while (!newData) {
                            waitFor(Serial.available, 120000);
                            recvWithEndMarker();
                        }
                        showNewNumber();
                        Log(" ");
                        if (num == 4 || num == 0) {
                            Log("Modbus config selected: %s >> Press 'y' to confirm: ", modbus_config_types[num]);
                            waitFor(Serial.available, 30000);
                            recvOneChar();
                            if (receivedChar == 'y') {
                                eepromValues.modbus_config = num;
                                saveEEPROM();
                                Log(" ");
                                Log("Modbus config saved: %s", modbus_config_types[eepromValues.modbus_config]);
                            }
                            else {
                                Log(" ");
                                Log("Modbus config failed");
                            }
                        }
                        else {
                            Log("Could not find config code. Back to Main Menu.");
                        }
                        break;
                    }
                    case '7': {
                        Log(">> Reset to modbus factory defaults. Press 'y' to confirm: ");
                        waitFor(Serial.available, 30000);
                        recvOneChar();
                        if (receivedChar == 'y') {
                            Log(" ");
                            Log("Resetting modbus factory defaults now");
                            eepromValues.modbus_slaveAddr = EEPROMvalues_default.modbus_slaveAddr;
                            eepromValues.modbus_baud = EEPROMvalues_default.modbus_baud;
                            eepromValues.modbus_config = EEPROMvalues_default.modbus_config;
                            eepromValues.modbus_slave_mode = EEPROMvalues_default.modbus_slave_mode;
                            saveEEPROM();
                            Log("Restarting");
                            System.reset();
                        }
                        else {
                            Log("Canceled");
                        }
                        break;
                    }
                    case 'x': {
                        Log("Exiting");
                        stay_in_menu = false;
                        break;
                    }
                    default: {
                        Log("Command not recognized.");
                    }
                }
            }
            break;
        }
        case 'r': {
            modbus_thread_go = false;
            LEDstandby.setActive();
            stay_in_menu = true;
            for (int i = 0; serial_menu_rtc_autowash[i] != NULL; i++) {
                Log(serial_menu_rtc_autowash[i]);
            }
            while (stay_in_menu) {
                waitFor(Serial.available, 120000);
                recvOneChar();
                showNewData();
                switch (receivedChar) {
                    case '1': {
                        Log("Current RTC datetime: %s", Time.timeStr().c_str());
                        break;
                    }
                    case '2': {
                        int timezone = 0, year = 0, month = 0, day = 0, hour = 0, minute = 0;
                        Log("Enter your timezone (integer only, use negative sign if required):");
                        recvNumber();
                        if (num >= -12 && num <= 14) {
                            timezone = num;
                            eepromValues.timezone = timezone;
                            saveEEPROM();
                            Time.zone(eepromValues.timezone);
                            Log("Timezone: %d\r\n", eepromValues.timezone);
                            Log("Enter the YEAR (4 digits only):");
                            recvNumber();
                            if (num >= 2000 && num <= 2100) {
                                year = num;
                                Log("Year: %d\r\n", year);
                                Log("Enter the MONTH (using numbers only):");
                                recvNumber();
                                if (num >= 1 && num <= 12) {
                                    month = num;
                                    Log("Month: %d\r\n", month);
                                    Log("Enter the DAY (using numbers only):");
                                    recvNumber();
                                    if (num >= 1 && num <= 31) {
                                        day = num;
                                        Log("Day: %d\r\n", day);
                                        Log("Enter the local HOUR (24hr format only!):");
                                        recvNumber();
                                        if (num >= 0 && num <= 23) {
                                            hour = num;
                                            Log("Hour: %d\r\n", hour);
                                            Log("Enter the local MINUTE:");
                                            recvNumber();
                                            if (num >= 0 && num <= 59) {
                                                minute = num;
                                                Log("Minute: %d\r\n", minute);
                                                Log("Setting time now...%d-%02d-%02d %02d:%02d:00 TZ%d", year,month,day,hour,minute,eepromValues.timezone);
                                                if (rtc_found) {
                                                    rtc.adjust(DateTime(year, month, day, hour, minute, 0));
                                                    //Convert to unix time and set Particle Time object
                                                    DateTime now = rtc.now() - TimeSpan(0, eepromValues.timezone, 0, 0);
                                                    Log("Unix time: %lu", now.unixtime());
                                                    Time.setTime(now.unixtime());
                                                    getNextWashTime();
                                                }
                                                else {
                                                    DateTime initialDateTime(year, month, day, hour, minute, 0);
                                                    Time.setTime(initialDateTime.unixtime());
                                                }
                                                Log("Time set! New time is: %s", Time.timeStr().c_str());
                                                au16data[13] = static_cast<uint16_t>(eepromValues.timezone);
                                                //Save new time to registers
                                                convert32to16(Time.now());
                                                au16data[20] = newConversion.val16[1];  //MB Master mode values
                                                au16data_20_last = newConversion.val16[1];
                                                au16data[21] = newConversion.val16[0];
                                                au16data_21_last = newConversion.val16[0];
                                                break;
                                            }
                                            else {
                                                Log("Not a valid minute: %d. Back to Main Menu.", num);
                                            }
                                            break;
                                        }
                                        else {
                                            Log("Not a valid hour: %d. Back to Main Menu.", num);
                                        }
                                        break;
                                    }
                                    else {
                                        Log("Not a valid month: %d. Back to Main Menu.", num);
                                    }
                                    break;
                                }
                                else {
                                    Log("Not a valid month: %d. Back to Main Menu.", num);
                                }
                                break;
                            }
                            else {
                                Log("Not a valid year: %d. Back to Main Menu.", num);
                            }
                            break;
                        }
                        else {
                            Log("Not a valid timezone value: %d. Back to Main Menu.", num);
                        }
                        break;
                    }
                    case '3': {
                        Log("Enter the local timezone (integer only, use negative sign if required):");
                        recvNumber();
                        if (num >= -12 && num <= 14) {
                            eepromValues.timezone = num;
                            saveEEPROM();
                            Time.zone(eepromValues.timezone);
                            Log("Timezone: %d\r\n", eepromValues.timezone);
                            Log("Timezone retained in Flash memory.");
                            au16data[13] = static_cast<uint16_t>(eepromValues.timezone);
                            Log("Timezone Modbus register 13 updated.");
                        }
                        else {
                            Log("Not a valid timezone value: %d. Back to Main Menu.", num);
                        }
                        break;
                    }
                    case '4': {
                        Log("Current AutoWash schedule (hours): %d, %d, %d", eepromValues.washHour1,eepromValues.washHour2,eepromValues.washHour3);
                        Log("If an Hour=25, a wash does not occur in that spot.");
                        Log("Skip Wash Freezing Threshold: %d C", eepromValues.wash_temp_LO - 273);
                        Log("Wash Seconds: %d s", eepromValues.wash_secs);
                        break;
                    }
                    case '5': {
                        for (int i = 0; i < 3; i++) {
                            Log("Enter 1st AutoWash Hour:");
                            recvNumber();
                            if ((num >= 0 && num <= 23) || num == 25) {
                                au16data[50] = eepromValues.washHour1 = num;
                                saveEEPROM();
                                Log("1st AutoWash Hour saved: %d\r\n", eepromValues.washHour1);
                                i = 3;
                            }
                            else {
                                Log("Not a valid Wash Hour - enter an integer from 0 to 23");
                            }
                        }
                        for (int i = 0; i < 3; i++) {
                            Log("Enter 2nd AutoWash Hour:");
                            recvNumber();
                            if ((num >= 0 && num <= 23) || num == 25) {
                                au16data[51] = eepromValues.washHour2 = num;
                                saveEEPROM();
                                Log("2nd AutoWash Hour saved: %d\r\n", eepromValues.washHour2);
                                i = 3;
                            }
                            else {
                                Log("Not a valid Wash Hour - enter an integer from 0 to 23");
                            }
                        }
                        for (int i = 0; i < 3; i++) {
                            Log("Enter 3rd AutoWash Hour:");
                            recvNumber();
                            if ((num >= 0 && num <= 23) || num == 25) {
                                au16data[52] = eepromValues.washHour3 = num;
                                saveEEPROM();
                                Log("3rd AutoWash Hour saved: %d\r\n", eepromValues.washHour3);
                                i = 3;
                            }
                            else {
                                Log("Not a valid Wash Hour - enter an integer from 0 to 23");
                            }
                        }
                        getNextWashTime();
                        break;
                    }
                    case '6': {
                        for (int i = 0; i < 3; i++) {
                            Log("Enter # seconds to AutoWash for (default is 5):");
                            recvNumber();
                            if (num >= 0 && num <= 900) {
                                au16data[49] = eepromValues.wash_secs = num;
                                saveEEPROM();
                                Log("# Wash seconds saved: %d\r\n", eepromValues.wash_secs);
                                i = 3;
                            }
                            else {
                                Log("Not a valid Wash seconds - enter an integer from 0 to 900");
                            }
                        }
                        break;
                    }
                    case '7': {
                        for (int i = 0; i < 3; i++) {
                            Log("Enter Skip Wash Freezing Threshold in degrees C:");
                            recvNumber();
                            if (num >= -40 && num <= 5) {
                                au16data[48] = eepromValues.wash_temp_LO = (num + 273);
                                saveEEPROM();
                                Log("Skip wash freezing threshold saved: %d deg C\r\n", eepromValues.wash_temp_LO - 273);
                                i = 3;
                            }
                            else {
                                Log("Not a valid Skip Wash freezing threshold - enter an integer from -40 to 5");
                            }
                        }
                        break;
                    }
                    case '8': {
                        if (eepromValues.lls_output_high_air) {
                            Log("Liquid level sensor is currently set HIGH IN AIR. Press 'y' to change it to LOW IN AIR...or 'n' to cancel.");
                        }
                        else {
                            Log("Liquid level sensor is currently set LOW IN AIR. Press 'y' to change it to HIGH IN AIR...or 'n' to cancel.");
                        }
                        waitFor(Serial.available, 120000);
                        recvOneChar();
                        if (receivedChar == 'y') {
                            if (eepromValues.lls_output_high_air) {
                                eepromValues.lls_output_high_air = false;
                                au16data[47] = 0;
                                Log("Liquid level sensor now set to LOW IN AIR.");
                            }
                            else {
                                eepromValues.lls_output_high_air = true;
                                au16data[47] = 1;
                                Log("Liquid level sensor now set to HIGH IN AIR.");
                            }
                            saveEEPROM();
                            delay(2000);
                        }
                        else {
                            Log(">> Canceled");
                        }
                        break;
                    }
                    case 'x': {
                        Log("Exiting");
                        stay_in_menu = false;
                        break;
                    }
                    default: {
                        Log("Command not recognized.");
                    }
                }
            }
            break;
        }
        case 'w': {
            modbus_thread_go = false;
            LEDstandby.setActive();
            stay_in_menu = true;
            for (int i = 0; serial_menu_wifi[i] != NULL; i++) {
                Log(serial_menu_wifi[i]);
            }
            while (stay_in_menu) {
                waitFor(Serial.available, 120000);
                recvOneChar();
                showNewData();
                switch (receivedChar) {
                    case '1': {
                        Log(">> Are you sure you want to turn ON WiFi mode? The Argon/Photon2 board must be setup with the correct WiFi credentials of the network.");
                        Log(">> The WiFi credentials can be setup in the Edge/Chrome browser through Particle WiFi WebUSB");
                        Log(">> LED will blink BLUE until WiFi credentials are entered.");
                        Log(">> Press 'y' to accept: ");
                        waitFor(Serial.available, 120000);
                        recvOneChar();
                        if (receivedChar == 'y') {
                            eepromValues.modbus_slave_mode = false;
                            eepromValues.wifi_mode = true;
                            saveEEPROM();
                            Log(" ");
                            Log("WiFi mode ON"); 
                            Log("Resetting now - credentials must be entered after reset.");
                            delay(2000);
                            System.reset();
                        }
                        else {
                            Log(">> Canceled");
                        }
                        break;
                    }
                    case '2': {
                        Log("WiFi mode OFF");
                        Log("Resetting now - WiFi is no longer enabled.");
                        eepromValues.modbus_slave_mode = false;
                        eepromValues.wifi_mode = false;
                        saveEEPROM();
                        delay(2000);
                        System.reset();
                        break;
                    }
                    case '3': {
                        if (eepromValues.wifi_mode) {
                            Log("Scanning for available WiFi networks now...");
                            int result_count = WiFi.scan(wifi_scan_callback);
                            Log_wifi("result_count=%d", result_count);
                        }
                        else {
                            Log("Can't scan - WiFi mode is OFF.");
                        }
                        break;
                    }
                    case '4': {
                        if (eepromValues.wifi_mode) {
                            Log_wifi("Listing all saved WiFi credentials");
                            WiFiAccessPoint ap[5];
                            int found = WiFi.getCredentials(ap, 5);
                            for (int i = 0; i < found; i++) {
                                Log_wifi("ssid: %s", ap[i].ssid);
                                Log_wifi("security: %d", (int) ap[i].security);
                                Log_wifi("cipher: %d", (int) ap[i].cipher);
                            }
                        }
                        else {
                            Log("Can't list credentials because WiFi mode is OFF.");
                        }
                        break;
                    }
                    case '5': {
                        ares_try_slavemode();
                        break;
                    }
                    case '6': {
                        ares_try_cellmode();
                        break;
                    }
                    case 'x': {
                        Log("Exiting");
                        stay_in_menu = false;
                        break;
                    }
                    default: {
                        Log("Command not recognized.");
                    }
                }
            }
            break;
        }
        case 'g': {
            Log("Running cleaning routine.");
            washNow();
            break;
        }
        case 'E': {
            LEDstandby.setActive();
            Log("Empty tank - run pump for 15 minutes? Press 'y' to confirm:");
            waitFor(Serial.available, 15000);
            recvOneChar();
            if (receivedChar == 'y') {
                eepromValues.wash_secs = 900;
                washNow();
                eepromValues.wash_secs = 5;
                saveEEPROM();
            }
            else {
                Log("Canceled");
            }
            break;
        }
        case 'S': {
            LEDstandby.setActive();
            Log("Enter a new serial number: ");
            while (!newData) {
                waitFor(Serial.available, 120000);
                recvWithEndMarker();
            }
            showNewNumber();
            Log(" ");
            if (1 <= num && num <= 9999) {
                eepromValues.WEC_SN = num;
                saveEEPROM();
                Log("New WEC Serial Number saved: %d", eepromValues.WEC_SN);
            }
            else {
                Log("Invalid serial number: %d . Exiting", num);
            }
            break;
        }
        case 'F': {
            LEDstandby.setActive();
            Log(" ");
            Log("----------");
            Log("Reset all factory defaults. Press 'y' to confirm:");
            waitFor(Serial.available, 30000);
            recvOneChar();
            if (receivedChar == 'y') {
                Log(" ");
                Log("Resetting to factory defaults now");
                eepromValues.version = 0;
                saveEEPROM();
                Log("Restarting");
                System.reset();
            }
            else {
                Log("Canceled");
            }
            break;
        }
        case ' ': {
            break;
        }
        default: {
            if (newData) Log("Command not recognized.");
        }
        receivedChar = '\0';
    }
    receivedChar = '\0';
    newData = false; 
}