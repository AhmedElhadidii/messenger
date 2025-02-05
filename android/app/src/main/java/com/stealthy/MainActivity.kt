package com.stealthy

import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.stealthy.sdk.BlockstackNativeModule
import com.facebook.react.ReactActivity
import com.facebook.react.bridge.Arguments

class MainActivity : ReactActivity() {

    /**
     * Returns the name of the main component registered from JavaScript.
     * This is used to schedule rendering of the component.
     */
    override fun getMainComponentName(): String? {
        return "stealthy"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (intent?.action == Intent.ACTION_VIEW) {
            handleAuthResponse(intent)
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)

        if (intent?.action == Intent.ACTION_VIEW) {
            handleAuthResponse(intent)
        }
    }

    private fun handleAuthResponse(intent: Intent) {
        val response = intent.dataString
        if (response != null) {
            val authResponseTokens = response.split(':')

            if (authResponseTokens.size > 1) {
                val authResponse = authResponseTokens[1]

                if (BlockstackNativeModule.currentSession != null) {
                    BlockstackNativeModule.currentSession!!.handlePendingSignIn(authResponse, { userData ->
                        if (userData.hasValue) {
                            // The user is now signed in!
                            Log.d("MainActivity", "user logged in")
                            if (BlockstackNativeModule.currentSignInPromise != null) {
                                val map = Arguments.createMap()
                                map.putString("decentralizedID", userData.value!!.decentralizedID)
                                map.putString("appPrivateKey", userData.value!!.appPrivateKey)
                                val jsonData = userData.value!!.json
                                val userName = jsonData.getString("username")
                                map.putString("username", userName)
//                                map.putString("profile", userData.value!!.profile.toString())
                                BlockstackNativeModule.currentSignInPromise!!.resolve(map)
                            }
                        }
                    })
                }
            }
        }
    }
}

